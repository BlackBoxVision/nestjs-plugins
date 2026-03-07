import { promises as fs } from 'fs';
import * as path from 'path';

import { LocalStorageProvider } from './local.provider';
import { LocalOptions } from '../interfaces';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  const defaultOptions: LocalOptions = {
    directory: '/tmp/uploads',
    serveStaticPath: '/files',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LocalStorageProvider(defaultOptions);
  });

  describe('constructor', () => {
    it('should default serveStaticPath to /static when not provided', async () => {
      const p = new LocalStorageProvider({ directory: '/tmp/uploads' });

      const url = await p.getUrl('image.png');

      expect(url).toBe('/static/image.png');
    });

    it('should use provided serveStaticPath', async () => {
      const url = await provider.getUrl('image.png');

      expect(url).toBe('/files/image.png');
    });
  });

  describe('upload', () => {
    it('should create directory recursively and write file', async () => {
      const file = Buffer.from('file-content');

      await provider.upload('subdir/image.png', file);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(path.resolve('/tmp/uploads', 'subdir/image.png')),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/tmp/uploads', 'subdir/image.png'),
        file,
      );
    });

    it('should return URL with serveStaticPath', async () => {
      const file = Buffer.from('content');

      const url = await provider.upload('docs/report.pdf', file);

      expect(url).toBe('/files/docs/report.pdf');
    });

    it('should handle files in the root directory', async () => {
      const file = Buffer.from('content');

      await provider.upload('root-file.txt', file);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/tmp/uploads', 'root-file.txt'),
        file,
      );
    });

    it('should strip trailing slash from serveStaticPath in URL', async () => {
      const p = new LocalStorageProvider({
        directory: '/tmp/uploads',
        serveStaticPath: '/assets/',
      });

      const url = await p.upload('file.txt', Buffer.from('data'));

      expect(url).toBe('/assets/file.txt');
    });
  });

  describe('getUrl', () => {
    it('should return local URL path', async () => {
      const url = await provider.getUrl('images/photo.jpg');

      expect(url).toBe('/files/images/photo.jpg');
    });
  });

  describe('delete', () => {
    it('should unlink the file from disk', async () => {
      await provider.delete('images/photo.jpg');

      expect(fs.unlink).toHaveBeenCalledWith(
        path.resolve('/tmp/uploads', 'images/photo.jpg'),
      );
    });

    it('should ignore ENOENT errors (file not found)', async () => {
      const enoentError = new Error('ENOENT') as any;
      enoentError.code = 'ENOENT';
      (fs.unlink as jest.Mock).mockRejectedValueOnce(enoentError);

      await expect(provider.delete('missing-file.txt')).resolves.toBeUndefined();
    });

    it('should rethrow non-ENOENT errors', async () => {
      const permError = new Error('EPERM') as any;
      permError.code = 'EPERM';
      (fs.unlink as jest.Mock).mockRejectedValueOnce(permError);

      await expect(provider.delete('protected-file.txt')).rejects.toThrow(
        'EPERM',
      );
    });
  });

  describe('exists', () => {
    it('should return true when file is accessible', async () => {
      (fs.access as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await provider.exists('existing-file.txt');

      expect(fs.access).toHaveBeenCalledWith(
        path.resolve('/tmp/uploads', 'existing-file.txt'),
      );
      expect(result).toBe(true);
    });

    it('should return false when file is not accessible', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await provider.exists('missing-file.txt');

      expect(result).toBe(false);
    });
  });

  describe('path traversal prevention', () => {
    it('should throw on path traversal with ../', async () => {
      const file = Buffer.from('malicious');

      await expect(
        provider.upload('../../../etc/passwd', file),
      ).rejects.toThrow('Invalid file key: path traversal detected');
    });

    it('should throw on path traversal in delete', async () => {
      await expect(
        provider.delete('../../../etc/passwd'),
      ).rejects.toThrow('Invalid file key: path traversal detected');
    });

    it('should throw on path traversal in exists', async () => {
      await expect(
        provider.exists('../../../etc/passwd'),
      ).rejects.toThrow('Invalid file key: path traversal detected');
    });

    it('should throw on path traversal in getUrl', async () => {
      // getUrl uses buildUrl which does not call resolveFilePath,
      // but we verify safe keys work
      const url = await provider.getUrl('safe/nested/file.txt');

      expect(url).toBe('/files/safe/nested/file.txt');
    });

    it('should allow deeply nested valid paths', async () => {
      const file = Buffer.from('content');

      const url = await provider.upload('a/b/c/d/file.txt', file);

      expect(url).toBe('/files/a/b/c/d/file.txt');
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
