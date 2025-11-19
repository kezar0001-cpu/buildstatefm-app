import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Blob } from 'node:buffer';

vi.mock('../lib/auth.js', () => ({
  getAuthToken: vi.fn(() => null),
  removeAuthToken: vi.fn(),
  saveAuthToken: vi.fn(),
}));

let originalWindow;

beforeAll(() => {
  originalWindow = globalThis.window;
  if (!originalWindow) {
    globalThis.window = {
      location: {
        origin: 'http://localhost',
        href: 'http://localhost/',
        pathname: '/',
      },
    };
  } else if (!originalWindow.location) {
    originalWindow.location = {
      origin: 'http://localhost',
      href: 'http://localhost/',
      pathname: '/',
    };
  }
});

afterAll(() => {
  if (!originalWindow) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

describe('apiClient request configuration', () => {
  const loadClient = async () => {
    const module = await import('./client.js');
    return module.default;
  };

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.VITE_API_BASE_URL;
    delete process.env.VITE_API_BASE;
    vi.clearAllMocks();
  });

  it('uses multipart content type when posting FormData', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['content'], { type: 'text/plain' }), 'test.txt');

    vi.resetModules();
    const apiClient = await loadClient();
    const originalAdapter = apiClient.defaults.adapter;

    let capturedConfig;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };

    await apiClient.post('/upload/multiple', formData);

    apiClient.defaults.adapter = originalAdapter;

    const headers = capturedConfig?.headers;
    let contentType;
    if (headers) {
      if (typeof headers.get === 'function') {
        contentType = headers.get('Content-Type') || headers.get('content-type');
      } else {
        contentType = headers['Content-Type'] || headers['content-type'];
      }
    }

    expect(contentType).toBeTruthy();
    expect(contentType).not.toMatch(/application\/json/i);
    expect(capturedConfig?.url).toBe('/api/upload/multiple');
  });

  it('does not double-prefix /api when base URL already includes it', async () => {
    vi.resetModules();
    process.env.VITE_API_BASE_URL = 'https://api.example.com/api';
    const apiClient = await loadClient();
    const originalAdapter = apiClient.defaults.adapter;

    let capturedConfig;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };

    await apiClient.get('/auth/login');

    apiClient.defaults.adapter = originalAdapter;

    expect(capturedConfig?.baseURL).toBe('https://api.example.com/api');
    expect(capturedConfig?.url).toBe('/api/auth/login');
  });
});
