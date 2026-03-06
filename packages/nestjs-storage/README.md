# @bbv/nestjs-storage

File storage module for NestJS with provider abstraction. Same API whether deploying to S3, Firebase Storage, DigitalOcean Spaces, or local disk.

## Installation

```bash
npm install @bbv/nestjs-storage
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@prisma/client`

## Prisma Schema (optional)

If using `trackUploads` feature:

```bash
cp node_modules/@bbv/nestjs-storage/prisma/storage.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

Provides: `StoredFile`

## Usage

```typescript
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
          forcePathStyle: true, // for MinIO
        },
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

## Providers

| Provider | Config key | Description |
|----------|-----------|-------------|
| AWS S3 | `s3` | S3 + MinIO compatible |
| Firebase | `firebase` | Google Cloud Storage / Firebase |
| DO Spaces | `do_spaces` | DigitalOcean Spaces (S3-compatible) |
| Local | `local` | Filesystem (dev/testing) |

### Provider Options

```typescript
// S3
{ provider: 's3', providerOptions: { endpoint, accessKeyId, secretAccessKey, bucket, region?, forcePathStyle? } }

// Firebase
{ provider: 'firebase', providerOptions: { projectId, bucket, credentials? } }

// DigitalOcean Spaces
{ provider: 'do_spaces', providerOptions: { endpoint, accessKeyId, secretAccessKey, bucket, region } }

// Local filesystem
{ provider: 'local', providerOptions: { directory, serveStaticPath? } }
```

## Feature Flags

| Flag | Default | What it controls |
|------|---------|-----------------|
| `trackUploads` | `false` | Persist file metadata to `StoredFile` table |
| `registerController` | `true` | Mount upload/delete REST endpoints |
| `imageProcessing` | `false` | Resize, crop, thumbnail generation |
| `signedUrls` | `true` | Generate pre-signed URLs |

## Service API

```typescript
import { StorageService } from '@bbv/nestjs-storage';

@Injectable()
export class PhotosService {
  constructor(private readonly storage: StorageService) {}

  async upload(file: Express.Multer.File) {
    return this.storage.upload(file);
  }

  async getUrl(key: string) {
    return this.storage.getUrl(key, { expiresIn: 3600 });
  }

  async remove(key: string) {
    await this.storage.delete(key);
  }
}
```

## Decorators

```typescript
import { ImageUpload, DocumentUpload, AvatarUpload } from '@bbv/nestjs-storage';

@Controller('photos')
export class PhotosController {
  @Post('upload')
  @ImageUpload('file')
  upload(@UploadedFile() file: Express.Multer.File) {}

  @Post('avatar')
  @AvatarUpload('file') // 2MB limit, images only
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {}
}
```

## REST Endpoints

When `registerController` is enabled:
- `POST /storage/upload` — Upload file (multipart)
- `DELETE /storage/:key` — Delete file
- `GET /storage/:key/url` — Get file URL

## License

[MIT](./LICENSE)
