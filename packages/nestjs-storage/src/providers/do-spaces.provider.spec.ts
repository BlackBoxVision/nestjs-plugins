import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import { DOSpacesStorageProvider } from './do-spaces.provider';
import { DOSpacesOptions } from '../interfaces';

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

describe('DOSpacesStorageProvider', () => {
  let provider: DOSpacesStorageProvider;
  let mockSend: jest.Mock;

  const defaultOptions: DOSpacesOptions = {
    endpoint: 'https://nyc3.digitaloceanspaces.com',
    accessKeyId: 'do-access-key',
    secretAccessKey: 'do-secret-key',
    bucket: 'my-space',
    region: 'nyc3',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new DOSpacesStorageProvider(defaultOptions);
    const clientInstance = (S3Client as jest.Mock).mock.results[0].value;
    mockSend = clientInstance.send;
  });

  describe('constructor', () => {
    it('should create S3Client with DO-specific endpoint and forcePathStyle false', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'nyc3',
        endpoint: 'https://nyc3.digitaloceanspaces.com',
        forcePathStyle: false,
        credentials: {
          accessKeyId: 'do-access-key',
          secretAccessKey: 'do-secret-key',
        },
      });
    });
  });

  describe('upload', () => {
    it('should default acl to public-read when not provided', async () => {
      const file = Buffer.from('space-content');

      await provider.upload('images/photo.jpg', file, {
        contentType: 'image/jpeg',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'my-space',
          Key: 'images/photo.jpg',
          Body: file,
          ContentType: 'image/jpeg',
          ACL: 'public-read',
        }),
      );
    });

    it('should respect custom acl when provided', async () => {
      const file = Buffer.from('content');

      await provider.upload('file.txt', file, {
        acl: 'private',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'private',
        }),
      );
    });

    it('should default acl to public-read when no options provided', async () => {
      const file = Buffer.from('content');

      await provider.upload('file.bin', file);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'public-read',
        }),
      );
    });

    it('should return DO Spaces URL format', async () => {
      const file = Buffer.from('content');

      const url = await provider.upload('docs/readme.md', file);

      expect(url).toBe(
        'https://nyc3.digitaloceanspaces.com/my-space/docs/readme.md',
      );
    });
  });

  describe('buildPublicUrl', () => {
    it('should use DO endpoint format: endpoint/bucket/key', async () => {
      const file = Buffer.from('data');

      const url = await provider.upload('path/to/file.txt', file);

      expect(url).toBe(
        'https://nyc3.digitaloceanspaces.com/my-space/path/to/file.txt',
      );
    });

    it('should strip trailing slash from endpoint', async () => {
      jest.clearAllMocks();
      const opts: DOSpacesOptions = {
        ...defaultOptions,
        endpoint: 'https://nyc3.digitaloceanspaces.com/',
      };
      const p = new DOSpacesStorageProvider(opts);

      const file = Buffer.from('data');
      const url = await p.upload('file.txt', file);

      expect(url).toBe(
        'https://nyc3.digitaloceanspaces.com/my-space/file.txt',
      );
    });
  });
});
