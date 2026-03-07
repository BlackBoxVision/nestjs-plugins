import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import {
  StorageModuleOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './interfaces';
import { S3StorageProvider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';
import { DOSpacesStorageProvider } from './providers/do-spaces.provider';

// Mock all providers to avoid real SDK dependencies
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// Mock firebase-admin so FirebaseStorageProvider can be instantiated
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    storage: jest.fn().mockReturnValue({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({}),
      }),
    }),
  }),
  credential: {
    cert: jest.fn().mockReturnValue('mock-cert'),
  },
}), { virtual: true });

describe('StorageModule', () => {
  describe('forRoot', () => {
    it('should register S3StorageProvider when provider is s3', () => {
      const options: StorageModuleOptions = {
        provider: 's3',
        providerOptions: {
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          bucket: 'test-bucket',
          region: 'us-east-1',
        },
      };

      const result = StorageModule.forRoot(options);

      expect(result.module).toBe(StorageModule);

      const storageProviderDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_PROVIDER,
      ) as any;
      expect(storageProviderDef).toBeDefined();
      expect(storageProviderDef.useValue).toBeInstanceOf(S3StorageProvider);
    });

    it('should register LocalStorageProvider when provider is local', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: {
          directory: '/tmp/uploads',
        },
      };

      const result = StorageModule.forRoot(options);

      const storageProviderDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_PROVIDER,
      ) as any;
      expect(storageProviderDef).toBeDefined();
      expect(storageProviderDef.useValue).toBeInstanceOf(
        LocalStorageProvider,
      );
    });

    it('should register DOSpacesStorageProvider when provider is do_spaces', () => {
      const options: StorageModuleOptions = {
        provider: 'do_spaces',
        providerOptions: {
          endpoint: 'https://nyc3.digitaloceanspaces.com',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          bucket: 'my-space',
          region: 'nyc3',
        },
      };

      const result = StorageModule.forRoot(options);

      const storageProviderDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_PROVIDER,
      ) as any;
      expect(storageProviderDef).toBeDefined();
      expect(storageProviderDef.useValue).toBeInstanceOf(
        DOSpacesStorageProvider,
      );
    });

    it('should always register StorageService', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
      };

      const result = StorageModule.forRoot(options);

      expect(result.providers).toEqual(
        expect.arrayContaining([StorageService]),
      );
    });

    it('should register STORAGE_MODULE_OPTIONS provider', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
      };

      const result = StorageModule.forRoot(options);

      const optionsDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_MODULE_OPTIONS,
      ) as any;
      expect(optionsDef).toBeDefined();
      expect(optionsDef.useValue).toBe(options);
    });

    it('should include StorageController when registerController feature is true', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
        features: { registerController: true },
      };

      const result = StorageModule.forRoot(options);

      expect(result.controllers).toContain(StorageController);
    });

    it('should exclude StorageController when registerController is not set', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
      };

      const result = StorageModule.forRoot(options);

      expect(result.controllers).not.toContain(StorageController);
      expect(result.controllers).toEqual([]);
    });

    it('should exclude StorageController when registerController is false', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
        features: { registerController: false },
      };

      const result = StorageModule.forRoot(options);

      expect(result.controllers).toEqual([]);
    });

    it('should export StorageService and STORAGE_PROVIDER', () => {
      const options: StorageModuleOptions = {
        provider: 'local',
        providerOptions: { directory: '/tmp' },
      };

      const result = StorageModule.forRoot(options);

      expect(result.exports).toContain(StorageService);
      expect(result.exports).toContain(STORAGE_PROVIDER);
    });

    it('should throw for unsupported provider', () => {
      const options = {
        provider: 'unsupported',
        providerOptions: {},
      } as any;

      expect(() => StorageModule.forRoot(options)).toThrow(
        'Unsupported storage provider: unsupported',
      );
    });
  });

  describe('forRootAsync', () => {
    it('should return a DynamicModule with async providers', () => {
      const result = StorageModule.forRootAsync({
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      expect(result.module).toBe(StorageModule);
      expect(result.providers).toBeDefined();
      expect(result.providers!.length).toBeGreaterThanOrEqual(3);
      expect(result.exports).toContain(StorageService);
      expect(result.exports).toContain(STORAGE_PROVIDER);
    });

    it('should include imports when provided', () => {
      const mockModule = { module: class MockModule {} };

      const result = StorageModule.forRootAsync({
        imports: [mockModule as any],
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      expect(result.imports).toContain(mockModule);
    });

    it('should default imports to empty array when not provided', () => {
      const result = StorageModule.forRootAsync({
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      expect(result.imports).toEqual([]);
    });

    it('should configure STORAGE_MODULE_OPTIONS with useFactory and inject', () => {
      const factory = jest.fn();
      const injectTokens = ['CONFIG_SERVICE'];

      const result = StorageModule.forRootAsync({
        useFactory: factory,
        inject: injectTokens,
      });

      const asyncOptionsDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_MODULE_OPTIONS,
      ) as any;

      expect(asyncOptionsDef).toBeDefined();
      expect(asyncOptionsDef.useFactory).toBe(factory);
      expect(asyncOptionsDef.inject).toEqual(injectTokens);
    });

    it('should default inject to empty array when not provided', () => {
      const result = StorageModule.forRootAsync({
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      const asyncOptionsDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_MODULE_OPTIONS,
      ) as any;

      expect(asyncOptionsDef.inject).toEqual([]);
    });

    it('should configure STORAGE_PROVIDER to depend on STORAGE_MODULE_OPTIONS', () => {
      const result = StorageModule.forRootAsync({
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      const asyncStorageDef = result.providers?.find(
        (p: any) => p.provide === STORAGE_PROVIDER,
      ) as any;

      expect(asyncStorageDef).toBeDefined();
      expect(asyncStorageDef.inject).toContain(STORAGE_MODULE_OPTIONS);
      expect(typeof asyncStorageDef.useFactory).toBe('function');
    });

    it('should always include StorageService in providers', () => {
      const result = StorageModule.forRootAsync({
        useFactory: () => ({
          provider: 'local' as const,
          providerOptions: { directory: '/tmp' },
        }),
      });

      expect(result.providers).toContain(StorageService);
    });
  });
});
