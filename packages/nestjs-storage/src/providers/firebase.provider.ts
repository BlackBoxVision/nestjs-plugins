import {
  StorageProvider,
  FirebaseOptions,
  UploadOptions,
  GetUrlOptions,
} from '../interfaces';

export class FirebaseStorageProvider implements StorageProvider {
  private storage: any;
  private readonly bucketName: string;

  constructor(private readonly options: FirebaseOptions) {
    this.bucketName = options.bucket;
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      // Dynamic import to avoid hard dependency on firebase-admin
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require('firebase-admin');

      const existingApp = admin.apps.find(
        (app: any) => app?.name === `storage-${this.options.projectId}`,
      );

      if (existingApp) {
        this.storage = existingApp.storage();
      } else {
        const app = admin.initializeApp(
          {
            projectId: this.options.projectId,
            storageBucket: this.options.bucket,
            ...(this.options.credentials
              ? { credential: admin.credential.cert(this.options.credentials) }
              : {}),
          },
          `storage-${this.options.projectId}`,
        );

        this.storage = app.storage();
      }
    } catch {
      throw new Error(
        'firebase-admin is not installed. Install it with: npm install firebase-admin',
      );
    }
  }

  async upload(
    key: string,
    file: Buffer,
    options?: UploadOptions,
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileRef = bucket.file(key);

    await fileRef.save(file, {
      contentType: options?.contentType,
      metadata: options?.metadata
        ? { metadata: options.metadata }
        : undefined,
    });

    await fileRef.makePublic();

    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileRef = bucket.file(key);

    const expiresIn = options?.expiresIn ?? 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });

    return url;
  }

  async delete(key: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileRef = bucket.file(key);

    await fileRef.delete({ ignoreNotFound: true });
  }

  async exists(key: string): Promise<boolean> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileRef = bucket.file(key);

    const [exists] = await fileRef.exists();

    return exists;
  }
}
