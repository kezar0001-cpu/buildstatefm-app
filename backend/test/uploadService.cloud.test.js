import test from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = {
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
};

function restoreS3Env() {
  const keys = Object.keys(ORIGINAL_ENV);
  for (const key of keys) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test('createUploadMiddleware uses S3 storage when AWS credentials are configured', async () => {
  try {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'demo-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'demo-secret-key';
    process.env.AWS_S3_BUCKET_NAME = 'demo-bucket';

    const module = await import(`../src/services/uploadService.js?cloud-${Date.now()}`);
    const { createUploadMiddleware, isUsingCloudStorage } = module;

    assert.equal(isUsingCloudStorage(), true, 'Cloud storage should be detected');

    const upload = createUploadMiddleware();
    assert.ok(upload.storage, 'multer upload should expose storage adapter');

    // Multer-S3 storage exposes _handleFile/_removeFile hooks.
    assert.equal(typeof upload.storage._handleFile, 'function');
    assert.equal(typeof upload.storage._removeFile, 'function');
  } finally {
    restoreS3Env();
  }
});

test('createUploadMiddleware enforces extension allow-list when provided', async () => {
  try {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_BUCKET_NAME;

    const module = await import(`../src/services/uploadService.js?local-${Date.now()}`);
    const { createUploadMiddleware } = module;

    const upload = createUploadMiddleware({
      allowedExtensions: ['.png'],
      allowedMimeTypes: ['image/png'],
    });

    assert.ok(upload.storage, 'multer upload should expose storage adapter');

    await new Promise((resolve, reject) => {
      const file = { mimetype: 'image/png', originalname: 'photo.png' };
      upload.fileFilter({}, file, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    await new Promise((resolve) => {
      const badFile = { mimetype: 'image/png', originalname: 'photo.jpg.exe' };
      upload.fileFilter({}, badFile, (err) => {
        assert.ok(err, 'should reject unexpected extension');
        assert.equal(err.code, 'LIMIT_UNEXPECTED_FILE');
        resolve();
      });
    });
  } finally {
    restoreS3Env();
  }
});
