import { describe, it, expect, beforeEach, vi } from 'vitest';

const authState = vi.hoisted(() => ({ token: null }));

vi.mock('../lib/auth.js', () => ({
  getAuthToken: vi.fn(() => authState.token),
  saveAuthToken: vi.fn((value) => {
    authState.token = value;
    return value;
  }),
  removeAuthToken: vi.fn(() => {
    authState.token = null;
  }),
}));

const loadClient = async () => {
  const module = await import('../api/client.js');
  return module.apiClient;
};

describe('apiClient configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    authState.token = null;
  });

  it('uses VITE_API_BASE_URL when provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/');

    const apiClient = await loadClient();

    expect(apiClient.defaults.baseURL).toBe('https://api.example.com');
  });

  it('defaults to window origin when environment variable is not set', async () => {
    const apiClient = await loadClient();

    expect(apiClient.defaults.baseURL).toBe(`${window.location.origin}/api`);
  });

  it('prefixes relative request paths with /api', async () => {
    const apiClient = await loadClient();

    const requestInterceptor = apiClient.interceptors.request.handlers[0].fulfilled;
    const result = await requestInterceptor({ url: '/service-requests', headers: {} });

    expect(result.url).toBe('/api/service-requests');
  });

  it('does not prefix absolute URLs', async () => {
    const apiClient = await loadClient();

    const requestInterceptor = apiClient.interceptors.request.handlers[0].fulfilled;
    const result = await requestInterceptor({
      url: 'https://external.example.com/jobs',
      headers: {},
    });

    expect(result.url).toBe('https://external.example.com/jobs');
  });

  it('attaches Authorization header when a token is available', async () => {
    const apiClient = await loadClient();
    authState.token = 'test-token';

    const requestInterceptor = apiClient.interceptors.request.handlers[0].fulfilled;
    const result = await requestInterceptor({ url: '/jobs', headers: {} });

    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  it('does not attach Authorization header when token is missing', async () => {
    const apiClient = await loadClient();

    const requestInterceptor = apiClient.interceptors.request.handlers[0].fulfilled;
    const result = await requestInterceptor({ url: '/jobs', headers: {} });

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('disables withCredentials by default for the axios instance', async () => {
    const apiClient = await loadClient();

    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
