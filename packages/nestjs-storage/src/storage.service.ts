import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as mimeTypes from 'mime-types';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';

import {
  StorageProvider,
  StorageModuleOptions,
  UploadOptions,
  GetUrlOptions,
  UploadResult,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './interfaces';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: StorageProvider,
    @Inject(STORAGE_MODULE_OPTIONS)
    private readonly options: StorageModuleOptions,
    @Optional()
    @Inject(PRISMA_SERVICE)
    private readonly prismaService?: any,
  ) {}

  async upload(
    file: Express.Multer.File,
    key?: string,
    uploadedBy?: string,
  ): Promise<UploadResult> {
    this.validateFile(file);

    const fileKey = key ?? this.generateKey(file.originalname);
    const contentType =
      file.mimetype || mimeTypes.lookup(file.originalname) || 'application/octet-stream';

    const uploadOptions: UploadOptions = {
      contentType,
    };

    this.logger.log(
      `Uploading file "${file.originalname}" as "${fileKey}" (${contentType}, ${file.size} bytes)`,
    );

    const url = await this.provider.upload(fileKey, file.buffer, uploadOptions);

    const result: UploadResult = {
      key: fileKey,
      url,
      bucket: this.getBucket(),
      provider: this.options.provider,
      mimeType: contentType,
      size: file.size,
      originalName: file.originalname,
    };

    if (this.shouldTrackUploads()) {
      await this.trackUpload(result, uploadedBy);
    }

    return result;
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    return this.provider.getUrl(key, options);
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`Deleting file "${key}"`);

    await this.provider.delete(key);

    if (this.shouldTrackUploads()) {
      await this.removeTrackedUpload(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  private validateFile(file: Express.Multer.File): void {
    if (
      this.options.maxFileSize &&
      file.size > this.options.maxFileSize
    ) {
      throw new BadRequestException(
        `File size ${file.size} exceeds maximum allowed size of ${this.options.maxFileSize} bytes`,
      );
    }

    if (
      this.options.allowedMimeTypes &&
      this.options.allowedMimeTypes.length > 0
    ) {
      const mimeType =
        file.mimetype || mimeTypes.lookup(file.originalname) || '';

      if (!this.options.allowedMimeTypes.includes(mimeType)) {
        throw new BadRequestException(
          `File type "${mimeType}" is not allowed. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
        );
      }
    }
  }

  private generateKey(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const ext = originalName.includes('.')
      ? `.${originalName.split('.').pop()}`
      : '';

    return `${timestamp}-${random}${ext}`;
  }

  private getBucket(): string {
    switch (this.options.provider) {
      case 's3':
        return this.options.providerOptions.bucket;
      case 'firebase':
        return this.options.providerOptions.bucket;
      case 'do_spaces':
        return this.options.providerOptions.bucket;
      case 'local':
        return this.options.providerOptions.directory;
    }
  }

  private shouldTrackUploads(): boolean {
    return !!(this.options.features?.trackUploads && this.prismaService);
  }

  private async trackUpload(
    result: UploadResult,
    uploadedBy?: string,
  ): Promise<void> {
    try {
      await this.prismaService.storedFile.create({
        data: {
          key: result.key,
          bucket: result.bucket,
          provider: result.provider,
          mimeType: result.mimeType,
          size: result.size,
          originalName: result.originalName,
          uploadedBy: uploadedBy ?? null,
        },
      });

      this.logger.debug(`Tracked upload for key "${result.key}"`);
    } catch (error) {
      this.logger.warn(
        `Failed to track upload for key "${result.key}": ${error}`,
      );
    }
  }

  private async removeTrackedUpload(key: string): Promise<void> {
    try {
      await this.prismaService.storedFile.deleteMany({
        where: { key },
      });

      this.logger.debug(`Removed tracked upload for key "${key}"`);
    } catch (error) {
      this.logger.warn(
        `Failed to remove tracked upload for key "${key}": ${error}`,
      );
    }
  }
}
