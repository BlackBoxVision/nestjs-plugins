import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { StorageProvider, S3Options, UploadOptions, GetUrlOptions } from '../interfaces';

export class S3StorageProvider implements StorageProvider {
  protected readonly client: S3Client;
  protected readonly bucket: string;

  constructor(protected readonly options: S3Options) {
    this.bucket = options.bucket;

    this.client = new S3Client({
      region: options.region ?? 'us-east-1',
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? false,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async upload(
    key: string,
    file: Buffer,
    options?: UploadOptions,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      ACL: options?.acl as any,
    });

    await this.client.send(command);

    return this.buildPublicUrl(key);
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const expiresIn = options?.expiresIn ?? 3600;

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  protected buildPublicUrl(key: string): string {
    if (this.options.endpoint) {
      const base = this.options.endpoint.replace(/\/$/, '');

      if (this.options.forcePathStyle) {
        return `${base}/${this.bucket}/${key}`;
      }

      return `${base}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.options.region ?? 'us-east-1'}.amazonaws.com/${key}`;
  }
}
