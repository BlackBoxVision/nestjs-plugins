# @bbv/nestjs-storage

> File storage module for NestJS with provider abstraction (S3, Firebase, DigitalOcean Spaces, Local).

## Overview

Same API whether deploying to AWS S3, Firebase Storage, DigitalOcean Spaces, or local disk. Features upload decorators with built-in MIME type validation, optional file tracking via Prisma, and an opt-in REST controller for upload/delete/URL endpoints. Swap providers by changing a single config value.

## Installation

```bash
npm install @bbv/nestjs-storage
```

### Peer Dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0` |
| `@nestjs/core` | `^10.0.0` |
| `@nestjs/platform-express` | `^10.0.0` |
| `@prisma/client` | `^5.0.0 \|\| ^6.0.0` |

Requires [`@bbv/nestjs-prisma`](../nestjs-prisma) if using `trackUploads` feature.

## Prisma Schema

Required only if using the `trackUploads` feature:

```bash
cp node_modules/@bbv/nestjs-storage/prisma/storage.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

**Models provided**:

| Model | Key Fields | Description |
|-------|-----------|-------------|
| `StoredFile` | `key` (unique), `bucket`, `provider`, `mimeType`, `size`, `originalName`, `uploadedBy?` | File metadata records |

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from '@bbv/nestjs-storage';

@Module({
  imports: [
    StorageModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        provider: 's3',
        providerOptions: {
          endpoint: config.get('S3_ENDPOINT'),
          accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
          bucket: config.getOrThrow('S3_BUCKET'),
          region: 'us-east-1',
          forcePathStyle: true, // required for MinIO
        },
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        features: {
          trackUploads: true,
          registerController: true,
          signedUrls: true,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Configuration

### `StorageModuleOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `'s3' \| 'firebase' \| 'do_spaces' \| 'local'` | **required** | Storage backend |
| `providerOptions` | (see below) | **required** | Provider-specific config |
| `maxFileSize` | `number` | -- | Max file size in bytes |
| `allowedMimeTypes` | `string[]` | -- | Whitelist of MIME types |
| `features.trackUploads` | `boolean` | `false` | Track uploads in `StoredFile` table |
| `features.registerController` | `boolean` | `false` | Mount REST upload/delete endpoints |
| `features.imageProcessing` | `boolean` | `false` | Image resize/crop support |
| `features.signedUrls` | `boolean` | `false` | Enable pre-signed URL generation |

### Provider Options

#### S3 / MinIO

```typescript
{ provider: 's3', providerOptions: {
  endpoint: 'https://s3.amazonaws.com',  // or MinIO URL
  accessKeyId: 'AKIA...',
  secretAccessKey: '...',
  bucket: 'my-bucket',
  region: 'us-east-1',        // optional
  forcePathStyle: false,       // true for MinIO
}}
```

#### Firebase Storage

```typescript
{ provider: 'firebase', providerOptions: {
  projectId: 'my-project',
  bucket: 'my-project.appspot.com',
  credentials: { /* service account JSON */ },  // optional
}}
```

#### DigitalOcean Spaces

```typescript
{ provider: 'do_spaces', providerOptions: {
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  accessKeyId: '...',
  secretAccessKey: '...',
  bucket: 'my-space',
  region: 'nyc3',
}}
```

#### Local Filesystem

```typescript
{ provider: 'local', providerOptions: {
  directory: './uploads',
  serveStaticPath: '/files',   // optional, for serve-static
}}
```

## API Reference

### `StorageService`

| Method | Signature | Description |
|--------|-----------|-------------|
| `upload` | `(file: Multer.File, key?, uploadedBy?) => UploadResult` | Upload file, auto-generates key if not provided |
| `getUrl` | `(key: string, options?) => string` | Get file URL (signed if configured) |
| `delete` | `(key: string) => void` | Delete file from storage (and DB if tracked) |
| `exists` | `(key: string) => boolean` | Check if file exists |

**`UploadResult`**:

```typescript
{
  key: string;          // Storage key
  url: string;          // Public or signed URL
  bucket: string;       // Bucket/directory name
  provider: string;     // Provider name
  mimeType: string;     // Detected MIME type
  size: number;         // File size in bytes
  originalName: string; // Original filename
}
```

### Upload Decorators

Pre-configured method decorators with MIME type validation and size limits:

```typescript
import { ImageUpload, DocumentUpload, AvatarUpload } from '@bbv/nestjs-storage';

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post('image')
  @ImageUpload('file')  // JPEG, PNG, GIF, WebP, SVG, AVIF -- 10MB max
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.storage.upload(file);
  }

  @Post('document')
  @DocumentUpload('file')  // PDF, Word, Excel, CSV, TXT -- 25MB max
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    return this.storage.upload(file);
  }

  @Post('avatar')
  @AvatarUpload('file')  // JPEG, PNG, WebP only -- 2MB max
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.storage.upload(file);
  }
}
```

| Decorator | Accepted Types | Max Size |
|-----------|---------------|----------|
| `@ImageUpload(field?, maxSize?)` | JPEG, PNG, GIF, WebP, SVG, AVIF | 10 MB |
| `@DocumentUpload(field?, maxSize?)` | PDF, Word, Excel, CSV, TXT | 25 MB |
| `@AvatarUpload(field?, maxSize?)` | JPEG, PNG, WebP | 2 MB |

All decorators accept optional `fieldName` (default: `'file'`) and `maxSize` override parameters.

### `StorageProvider` Interface

All providers implement:

```typescript
interface StorageProvider {
  upload(key: string, file: Buffer, options?: UploadOptions): Promise<string>;
  getUrl(key: string, options?: GetUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

### REST Endpoints

When `features.registerController` is enabled:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/storage/upload` | Upload file (multipart, field: `file`) |
| `DELETE` | `/storage/:key` | Delete file by key |
| `GET` | `/storage/:key/url` | Get file URL (`?expiresIn=3600` for signed) |

## Architecture

```
StorageModule
  forRoot() / forRootAsync()
  |
  +-- StorageController (/storage)  -- opt-in REST endpoints
  |
  +-- StorageService                -- upload, getUrl, delete, exists
  |     +-- validates file (size, MIME type)
  |     +-- delegates to StorageProvider
  |     +-- tracks in Prisma (if trackUploads)
  |
  +-- StorageProvider (interface)
        +-- S3StorageProvider       -- AWS SDK v3
        +-- FirebaseStorageProvider
        +-- DOSpacesStorageProvider
        +-- LocalStorageProvider    -- filesystem
```

## License

[MIT](../../LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)
