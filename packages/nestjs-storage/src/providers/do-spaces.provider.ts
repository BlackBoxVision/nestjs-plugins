import { DOSpacesOptions, UploadOptions } from '../interfaces';
import { S3StorageProvider } from './s3.provider';

/**
 * DigitalOcean Spaces storage provider.
 *
 * Since DO Spaces is S3-compatible, this provider extends S3StorageProvider
 * with DigitalOcean-specific defaults and URL construction.
 */
export class DOSpacesStorageProvider extends S3StorageProvider {
  private readonly spacesOptions: DOSpacesOptions;

  constructor(options: DOSpacesOptions) {
    super({
      endpoint: options.endpoint,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      bucket: options.bucket,
      region: options.region,
      forcePathStyle: false,
    });

    this.spacesOptions = options;
  }

  override async upload(
    key: string,
    file: Buffer,
    options?: UploadOptions,
  ): Promise<string> {
    const uploadOptions: UploadOptions = {
      ...options,
      acl: options?.acl ?? 'public-read',
    };

    return super.upload(key, file, uploadOptions);
  }

  protected override buildPublicUrl(key: string): string {
    // DO Spaces CDN URL format: https://<bucket>.<region>.cdn.digitaloceanspaces.com/<key>
    const endpoint = this.spacesOptions.endpoint.replace(/\/$/, '');

    return `${endpoint}/${this.spacesOptions.bucket}/${key}`;
  }
}
