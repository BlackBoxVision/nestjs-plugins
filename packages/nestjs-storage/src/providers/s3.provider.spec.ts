import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { S3StorageProvider } from './s3.provider';
import { S3Options } from '../interfaces';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});

  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://signed-url.example.com/test'),
}));

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let mockSend: jest.Mock;

  const defaultOptions: S3Options = {
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    bucket: 'test-bucket',
    region: 'us-west-2',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new S3StorageProvider(defaultOptions);
    // Retrieve the mock send function from the instantiated client
    const clientInstance = (S3Client as jest.Mock).mock.results[0].value;
    mockSend = clientInstance.send;
  });

  describe('constructor', () => {
    it('should create S3Client with correct region and credentials', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-west-2',
        endpoint: undefined,
        forcePathStyle: false,
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should default region to us-east-1 when not provided', () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'bucket',
      };

      new S3StorageProvider(opts);

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        }),
      );
    });

    it('should pass endpoint and forcePathStyle when provided', () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'bucket',
        region: 'eu-west-1',
        endpoint: 'https://custom-s3.example.com',
        forcePathStyle: true,
      };

      new S3StorageProvider(opts);

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://custom-s3.example.com',
          forcePathStyle: true,
        }),
      );
    });
  });

  describe('upload', () => {
    it('should send PutObjectCommand with correct parameters', async () => {
      const file = Buffer.from('file-content');

      await provider.upload('path/to/file.txt', file, {
        contentType: 'text/plain',
        metadata: { author: 'test' },
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'path/to/file.txt',
        Body: file,
        ContentType: 'text/plain',
        Metadata: { author: 'test' },
        ACL: undefined,
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should send PutObjectCommand with ACL when provided', async () => {
      const file = Buffer.from('file-content');

      await provider.upload('key.txt', file, {
        acl: 'public-read',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'public-read',
        }),
      );
    });

    it('should return the public URL after upload', async () => {
      const file = Buffer.from('content');

      const result = await provider.upload('images/photo.jpg', file);

      expect(result).toBe(
        'https://test-bucket.s3.us-west-2.amazonaws.com/images/photo.jpg',
      );
    });

    it('should handle upload without options', async () => {
      const file = Buffer.from('content');

      await provider.upload('file.bin', file);

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file.bin',
        Body: file,
        ContentType: undefined,
        Metadata: undefined,
        ACL: undefined,
      });
    });
  });

  describe('getUrl', () => {
    it('should generate presigned URL with default 3600 expiration', async () => {
      const url = await provider.getUrl('path/to/file.txt');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'path/to/file.txt',
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 },
      );
      expect(url).toBe('https://signed-url.example.com/test');
    });

    it('should use custom expiration when provided', async () => {
      await provider.getUrl('file.txt', { expiresIn: 7200 });

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 7200 },
      );
    });
  });

  describe('delete', () => {
    it('should send DeleteObjectCommand with correct bucket and key', async () => {
      await provider.delete('path/to/file.txt');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'path/to/file.txt',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('exists', () => {
    it('should return true when HeadObject succeeds', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await provider.exists('existing-file.txt');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'existing-file.txt',
      });
      expect(result).toBe(true);
    });

    it('should return false when HeadObject throws an error', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      const result = await provider.exists('missing-file.txt');

      expect(result).toBe(false);
    });
  });

  describe('buildPublicUrl', () => {
    it('should format URL with endpoint and forcePathStyle', async () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'my-bucket',
        region: 'us-east-1',
        endpoint: 'https://minio.example.com',
        forcePathStyle: true,
      };
      const p = new S3StorageProvider(opts);
      const file = Buffer.from('data');

      const url = await p.upload('docs/file.pdf', file);

      expect(url).toBe('https://minio.example.com/my-bucket/docs/file.pdf');
    });

    it('should format URL with endpoint without forcePathStyle', async () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'my-bucket',
        region: 'us-east-1',
        endpoint: 'https://cdn.example.com',
        forcePathStyle: false,
      };
      const p = new S3StorageProvider(opts);
      const file = Buffer.from('data');

      const url = await p.upload('docs/file.pdf', file);

      expect(url).toBe('https://cdn.example.com/docs/file.pdf');
    });

    it('should format default S3 URL without endpoint', async () => {
      const file = Buffer.from('data');

      const url = await provider.upload('images/pic.png', file);

      expect(url).toBe(
        'https://test-bucket.s3.us-west-2.amazonaws.com/images/pic.png',
      );
    });

    it('should strip trailing slash from endpoint', async () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'my-bucket',
        region: 'us-east-1',
        endpoint: 'https://minio.example.com/',
        forcePathStyle: true,
      };
      const p = new S3StorageProvider(opts);
      const file = Buffer.from('data');

      const url = await p.upload('file.txt', file);

      expect(url).toBe('https://minio.example.com/my-bucket/file.txt');
    });

    it('should default region to us-east-1 in URL when region is not set', async () => {
      jest.clearAllMocks();
      const opts: S3Options = {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'my-bucket',
      };
      const p = new S3StorageProvider(opts);
      const file = Buffer.from('data');

      const url = await p.upload('file.txt', file);

      expect(url).toBe(
        'https://my-bucket.s3.us-east-1.amazonaws.com/file.txt',
      );
    });
  });
});
