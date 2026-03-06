export interface S3Options {
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  forcePathStyle?: boolean;
}

export interface FirebaseOptions {
  projectId: string;
  bucket: string;
  credentials?: Record<string, unknown>;
}

export interface DOSpacesOptions {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
}

export interface LocalOptions {
  directory: string;
  serveStaticPath?: string;
}

export type StorageProviderConfig =
  | { provider: 's3'; providerOptions: S3Options }
  | { provider: 'firebase'; providerOptions: FirebaseOptions }
  | { provider: 'do_spaces'; providerOptions: DOSpacesOptions }
  | { provider: 'local'; providerOptions: LocalOptions };

export interface StorageFeatures {
  trackUploads?: boolean;
  registerController?: boolean;
  imageProcessing?: boolean;
  signedUrls?: boolean;
}

export type StorageModuleOptions = StorageProviderConfig & {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  features?: StorageFeatures;
};

export interface StorageModuleAsyncOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<StorageModuleOptions> | StorageModuleOptions;
  inject?: any[];
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: string;
}

export interface GetUrlOptions {
  expiresIn?: number;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  provider: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export interface StorageProvider {
  upload(key: string, file: Buffer, options?: UploadOptions): Promise<string>;
  getUrl(key: string, options?: GetUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_MODULE_OPTIONS = 'STORAGE_MODULE_OPTIONS';
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
