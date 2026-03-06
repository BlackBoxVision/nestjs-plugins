import * as fs from 'fs/promises';
import * as path from 'path';

import {
  StorageProvider,
  LocalOptions,
  UploadOptions,
  GetUrlOptions,
} from '../interfaces';

export class LocalStorageProvider implements StorageProvider {
  private readonly directory: string;
  private readonly serveStaticPath: string;

  constructor(private readonly options: LocalOptions) {
    this.directory = options.directory;
    this.serveStaticPath = options.serveStaticPath ?? '/static';
  }

  async upload(
    key: string,
    file: Buffer,
    _options?: UploadOptions,
  ): Promise<string> {
    const filePath = this.resolveFilePath(key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file);

    return this.buildUrl(key);
  }

  async getUrl(key: string, _options?: GetUrlOptions): Promise<string> {
    return this.buildUrl(key);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveFilePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private resolveFilePath(key: string): string {
    const resolved = path.resolve(this.directory, key);

    // Prevent path traversal attacks
    if (!resolved.startsWith(path.resolve(this.directory))) {
      throw new Error('Invalid file key: path traversal detected');
    }

    return resolved;
  }

  private buildUrl(key: string): string {
    const base = this.serveStaticPath.replace(/\/$/, '');

    return `${base}/${key}`;
  }
}
