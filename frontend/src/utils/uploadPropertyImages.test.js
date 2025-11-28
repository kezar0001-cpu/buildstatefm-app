import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import apiClient from '../api/client.js';
import { uploadPropertyImages, normaliseUploadedImages } from './uploadPropertyImages.js';

const OriginalFile = globalThis.File;

class TestFile extends Blob {
  constructor(parts, name, options) {
    super(parts, options);
    this.name = name;
  }
}

beforeAll(() => {
  globalThis.File = TestFile;
});

afterAll(() => {
  if (OriginalFile) {
    globalThis.File = OriginalFile;
  } else {
    delete globalThis.File;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadPropertyImages', () => {
  it('uploads files without overriding the Content-Type header', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { urls: ['/uploads/one.png', '/uploads/two.png'] },
    });

    const files = [
      new File(['first'], 'one.png', { type: 'image/png' }),
      new File(['second'], 'two.png', { type: 'image/png' }),
    ];

    const result = await uploadPropertyImages(files);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, body, config] = postSpy.mock.calls[0];
    expect(url).toBe('/upload/multiple');
    expect(body).toBeInstanceOf(FormData);
    expect(config).toBeUndefined();
    expect(result).toEqual([
      { url: '/uploads/one.png', name: 'one.png' },
      { url: '/uploads/two.png', name: 'two.png' },
    ]);
  });

  it('ignores non-File entries', async () => {
    const postSpy = vi.spyOn(apiClient, 'post');

    const result = await uploadPropertyImages([null, undefined, { name: 'nope' }]);

    expect(postSpy).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('throws when upload response is missing urls', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { urls: [] } });

    const file = new File(['first'], 'one.png', { type: 'image/png' });

    await expect(uploadPropertyImages([file])).rejects.toThrow('Upload failed');
  });
});

describe('normaliseUploadedImages', () => {
  it('returns normalised image data for valid entries', () => {
    const result = normaliseUploadedImages([
      { id: '123', imageUrl: 'https://example.com/a.png', caption: 'A' },
      { url: 'https://example.com/b.png', name: 'File B', altText: 'B alt' },
      { imageUrl: '   ' },
      null,
    ]);

    expect(result).toEqual([
      { id: '123', imageUrl: 'https://example.com/a.png', caption: 'A', isPrimary: false, displayOrder: 0 },
      { id: 'image-1', imageUrl: 'https://example.com/b.png', caption: 'B alt', isPrimary: false, displayOrder: 1 },
    ]);
  });
});
