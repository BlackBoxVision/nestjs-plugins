import { FirebaseStorageProvider } from './firebase.provider';
import { FirebaseOptions } from '../interfaces';

const mockFileRef = {
  save: jest.fn().mockResolvedValue(undefined),
  makePublic: jest.fn().mockResolvedValue(undefined),
  getSignedUrl: jest
    .fn()
    .mockResolvedValue(['https://signed-url.firebase.example.com/file']),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue([true]),
};

const mockBucket = {
  file: jest.fn().mockReturnValue(mockFileRef),
};

const mockStorage = {
  bucket: jest.fn().mockReturnValue(mockBucket),
};

const mockApp = {
  storage: jest.fn().mockReturnValue(mockStorage),
};

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue(mockApp),
  credential: {
    cert: jest.fn().mockReturnValue('mock-cert'),
  },
}), { virtual: true });

describe('FirebaseStorageProvider', () => {
  let provider: FirebaseStorageProvider;

  const defaultOptions: FirebaseOptions = {
    projectId: 'test-project',
    bucket: 'test-bucket.appspot.com',
    credentials: { type: 'service_account', project_id: 'test-project' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock returns after clearing
    mockBucket.file.mockReturnValue(mockFileRef);
    mockStorage.bucket.mockReturnValue(mockBucket);
    mockApp.storage.mockReturnValue(mockStorage);
    mockFileRef.save.mockResolvedValue(undefined);
    mockFileRef.makePublic.mockResolvedValue(undefined);
    mockFileRef.getSignedUrl.mockResolvedValue([
      'https://signed-url.firebase.example.com/file',
    ]);
    mockFileRef.delete.mockResolvedValue(undefined);
    mockFileRef.exists.mockResolvedValue([true]);

    provider = new FirebaseStorageProvider(defaultOptions);
  });

  describe('constructor', () => {
    it('should initialize firebase app with correct config', () => {
      const admin = require('firebase-admin');

      expect(admin.initializeApp).toHaveBeenCalledWith(
        {
          projectId: 'test-project',
          storageBucket: 'test-bucket.appspot.com',
          credential: 'mock-cert',
        },
        'storage-test-project',
      );
      expect(admin.credential.cert).toHaveBeenCalledWith(
        defaultOptions.credentials,
      );
    });

    it('should initialize without credentials when not provided', () => {
      jest.clearAllMocks();
      mockApp.storage.mockReturnValue(mockStorage);

      const opts: FirebaseOptions = {
        projectId: 'no-creds-project',
        bucket: 'no-creds-bucket',
      };

      new FirebaseStorageProvider(opts);

      const admin = require('firebase-admin');

      expect(admin.initializeApp).toHaveBeenCalledWith(
        {
          projectId: 'no-creds-project',
          storageBucket: 'no-creds-bucket',
        },
        'storage-no-creds-project',
      );
      expect(admin.credential.cert).not.toHaveBeenCalled();
    });

    it('should reuse existing app if already initialized', () => {
      const admin = require('firebase-admin');
      const existingApp = {
        name: 'storage-test-project',
        storage: jest.fn().mockReturnValue(mockStorage),
      };
      admin.apps = [existingApp];

      jest.clearAllMocks();

      new FirebaseStorageProvider(defaultOptions);

      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(existingApp.storage).toHaveBeenCalled();

      // Reset for other tests
      admin.apps = [];
    });
  });

  describe('upload', () => {
    it('should save file and make it public', async () => {
      const file = Buffer.from('test-content');

      await provider.upload('images/photo.jpg', file, {
        contentType: 'image/jpeg',
      });

      expect(mockStorage.bucket).toHaveBeenCalledWith(
        'test-bucket.appspot.com',
      );
      expect(mockBucket.file).toHaveBeenCalledWith('images/photo.jpg');
      expect(mockFileRef.save).toHaveBeenCalledWith(file, {
        contentType: 'image/jpeg',
        metadata: undefined,
      });
      expect(mockFileRef.makePublic).toHaveBeenCalled();
    });

    it('should return the public Google Storage URL', async () => {
      const file = Buffer.from('content');

      const url = await provider.upload('docs/report.pdf', file);

      expect(url).toBe(
        'https://storage.googleapis.com/test-bucket.appspot.com/docs/report.pdf',
      );
    });

    it('should pass metadata when provided', async () => {
      const file = Buffer.from('content');

      await provider.upload('file.txt', file, {
        contentType: 'text/plain',
        metadata: { author: 'tester', version: '1' },
      });

      expect(mockFileRef.save).toHaveBeenCalledWith(file, {
        contentType: 'text/plain',
        metadata: { metadata: { author: 'tester', version: '1' } },
      });
    });

    it('should handle upload without options', async () => {
      const file = Buffer.from('content');

      await provider.upload('file.bin', file);

      expect(mockFileRef.save).toHaveBeenCalledWith(file, {
        contentType: undefined,
        metadata: undefined,
      });
    });
  });

  describe('getUrl', () => {
    it('should return a signed URL with default expiration', async () => {
      const url = await provider.getUrl('images/photo.jpg');

      expect(mockBucket.file).toHaveBeenCalledWith('images/photo.jpg');
      expect(mockFileRef.getSignedUrl).toHaveBeenCalledWith({
        action: 'read',
        expires: expect.any(Date),
      });
      expect(url).toBe(
        'https://signed-url.firebase.example.com/file',
      );
    });

    it('should use custom expiration when provided', async () => {
      const beforeCall = Date.now();

      await provider.getUrl('file.txt', { expiresIn: 7200 });

      const callArgs = mockFileRef.getSignedUrl.mock.calls[0][0];
      const expiresDate = callArgs.expires as Date;
      // The expiration should be approximately 7200 seconds from now
      const expectedMin = beforeCall + 7200 * 1000 - 1000;
      const expectedMax = beforeCall + 7200 * 1000 + 1000;

      expect(expiresDate.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresDate.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should default expiration to 3600 seconds', async () => {
      const beforeCall = Date.now();

      await provider.getUrl('file.txt');

      const callArgs = mockFileRef.getSignedUrl.mock.calls[0][0];
      const expiresDate = callArgs.expires as Date;
      const expectedMin = beforeCall + 3600 * 1000 - 1000;
      const expectedMax = beforeCall + 3600 * 1000 + 1000;

      expect(expiresDate.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresDate.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('delete', () => {
    it('should delete the file with ignoreNotFound option', async () => {
      await provider.delete('images/photo.jpg');

      expect(mockBucket.file).toHaveBeenCalledWith('images/photo.jpg');
      expect(mockFileRef.delete).toHaveBeenCalledWith({
        ignoreNotFound: true,
      });
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockFileRef.exists.mockResolvedValueOnce([true]);

      const result = await provider.exists('images/photo.jpg');

      expect(mockBucket.file).toHaveBeenCalledWith('images/photo.jpg');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFileRef.exists.mockResolvedValueOnce([false]);

      const result = await provider.exists('missing/file.txt');

      expect(result).toBe(false);
    });
  });
});
