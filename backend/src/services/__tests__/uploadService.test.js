import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

async function loadModule(extra = '') {
  const suffix = `?${Date.now()}${extra}`;
  return import(`../uploadService.js${suffix}`);
}

describe('uploadService local upload paths', () => {
  it('returns /uploads URLs for local storage by default', async () => {
    delete process.env.UPLOADS_PUBLIC_PATH;

    const mod = await loadModule();
    const { getUploadedFileUrl, LOCAL_UPLOADS_PUBLIC_PATH } = mod;

    assert.equal(LOCAL_UPLOADS_PUBLIC_PATH, '/uploads');

    const url = getUploadedFileUrl({ filename: 'example.png' });
    assert.equal(url, '/uploads/example.png');
  });

  it('recognises legacy /api/uploads URLs when cleaning up files', async () => {
    delete process.env.UPLOADS_PUBLIC_PATH;

    const mod = await loadModule('&legacy=1');
    const { isLocalUploadUrl, extractLocalUploadFilename } = mod;

    assert.equal(isLocalUploadUrl('/api/uploads/test.jpg'), true);
    assert.equal(extractLocalUploadFilename('/api/uploads/test.jpg'), 'test.jpg');
    assert.equal(isLocalUploadUrl('/uploads/test.jpg'), true);
    assert.equal(extractLocalUploadFilename('/uploads/test.jpg'), 'test.jpg');
  });

  it('respects UPLOADS_PUBLIC_PATH overrides and normalises them', async () => {
    process.env.UPLOADS_PUBLIC_PATH = 'media/assets/';

    const mod = await loadModule('&custom=1');
    const { getUploadedFileUrl, LOCAL_UPLOADS_PUBLIC_PATH } = mod;

    assert.equal(LOCAL_UPLOADS_PUBLIC_PATH, '/media/assets');
    const url = getUploadedFileUrl({ filename: 'asset.webp' });
    assert.equal(url, '/media/assets/asset.webp');

    delete process.env.UPLOADS_PUBLIC_PATH;
  });
});
