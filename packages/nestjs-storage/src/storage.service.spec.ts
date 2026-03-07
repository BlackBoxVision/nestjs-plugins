import { Test, TestingModule } from '@nestjs/testing';

import { StorageService } from './storage.service';
import {
  StorageProvider,
  StorageModuleOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './interfaces';

describe('StorageService', () => {
  let service: StorageService;
  let mockProvider: jest.Mocked<StorageProvider>;
  let mockPrismaService: any;

  const defaultOptions: StorageModuleOptions = {
    provider: 's3',
    providerOptions: {
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
      region: 'us-east-1',
    },
  };

  const createMockFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test-file-content'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  beforeEach(async () => {
    mockProvider = {
      upload: jest.fn().mockResolvedValue('https://cdn.example.com/test-key'),
      getUrl: jest
        .fn()
        .mockResolvedValue('https://cdn.example.com/signed/test-key'),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    };

    mockPrismaService = {
      storedFile: {
        create: jest.fn().mockResolvedValue({ id: 'cuid-123' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PROVIDER, useValue: mockProvider },
        { provide: STORAGE_MODULE_OPTIONS, useValue: defaultOptions },
        { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('upload', () => {
    it('should upload a file and return an UploadResult', async () => {
      const file = createMockFile();

      const result = await service.upload(file);

      expect(result).toEqual(
        expect.objectContaining({
          url: 'https://cdn.example.com/test-key',
          bucket: 'test-bucket',
          provider: 's3',
          mimeType: 'image/png',
          size: 1024,
          originalName: 'test-image.png',
        }),
      );
      expect(result.key).toBeDefined();
      expect(mockProvider.upload).toHaveBeenCalledWith(
        result.key,
        file.buffer,
        expect.objectContaining({ contentType: 'image/png' }),
      );
    });

    it('should use a custom key when provided', async () => {
      const file = createMockFile();
      const customKey = 'custom/path/image.png';

      const result = await service.upload(file, customKey);

      expect(result.key).toBe(customKey);
      expect(mockProvider.upload).toHaveBeenCalledWith(
        customKey,
        file.buffer,
        expect.any(Object),
      );
    });

    it('should generate a key with the original file extension', async () => {
      const file = createMockFile({ originalname: 'photo.jpg' });

      const result = await service.upload(file);

      expect(result.key).toMatch(/\.jpg$/);
    });

    it('should reject files exceeding maxFileSize', async () => {
      const optionsWithLimit: StorageModuleOptions = {
        ...defaultOptions,
        maxFileSize: 512,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: STORAGE_PROVIDER, useValue: mockProvider },
          { provide: STORAGE_MODULE_OPTIONS, useValue: optionsWithLimit },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);
      const file = createMockFile({ size: 1024 });

      await expect(svc.upload(file)).rejects.toThrow(
        'File size 1024 exceeds maximum allowed size of 512 bytes',
      );
    });

    it('should reject files with disallowed MIME types', async () => {
      const optionsWithTypes: StorageModuleOptions = {
        ...defaultOptions,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: STORAGE_PROVIDER, useValue: mockProvider },
          { provide: STORAGE_MODULE_OPTIONS, useValue: optionsWithTypes },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);
      const file = createMockFile({ mimetype: 'application/pdf' });

      await expect(svc.upload(file)).rejects.toThrow(
        'File type "application/pdf" is not allowed',
      );
    });

    it('should track upload in database when trackUploads is enabled', async () => {
      const optionsWithTracking: StorageModuleOptions = {
        ...defaultOptions,
        features: { trackUploads: true },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: STORAGE_PROVIDER, useValue: mockProvider },
          { provide: STORAGE_MODULE_OPTIONS, useValue: optionsWithTracking },
          { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);
      const file = createMockFile();

      await svc.upload(file, 'tracked-key', 'user-123');

      expect(mockPrismaService.storedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'tracked-key',
          bucket: 'test-bucket',
          provider: 's3',
          mimeType: 'image/png',
          size: 1024,
          originalName: 'test-image.png',
          uploadedBy: 'user-123',
        }),
      });
    });

    it('should not track upload when trackUploads is disabled', async () => {
      const file = createMockFile();

      await service.upload(file);

      expect(mockPrismaService.storedFile.create).not.toHaveBeenCalled();
    });
  });

  describe('getUrl', () => {
    it('should return a URL from the provider', async () => {
      const url = await service.getUrl('some-key');

      expect(url).toBe('https://cdn.example.com/signed/test-key');
      expect(mockProvider.getUrl).toHaveBeenCalledWith('some-key', undefined);
    });

    it('should forward GetUrlOptions to the provider', async () => {
      await service.getUrl('some-key', { expiresIn: 7200 });

      expect(mockProvider.getUrl).toHaveBeenCalledWith('some-key', {
        expiresIn: 7200,
      });
    });
  });

  describe('delete', () => {
    it('should delete a file via the provider', async () => {
      await service.delete('some-key');

      expect(mockProvider.delete).toHaveBeenCalledWith('some-key');
    });

    it('should remove tracked upload when trackUploads is enabled', async () => {
      const optionsWithTracking: StorageModuleOptions = {
        ...defaultOptions,
        features: { trackUploads: true },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: STORAGE_PROVIDER, useValue: mockProvider },
          { provide: STORAGE_MODULE_OPTIONS, useValue: optionsWithTracking },
          { provide: 'PRISMA_SERVICE', useValue: mockPrismaService },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);

      await svc.delete('tracked-key');

      expect(mockPrismaService.storedFile.deleteMany).toHaveBeenCalledWith({
        where: { key: 'tracked-key' },
      });
    });

    it('should not remove tracked upload when trackUploads is disabled', async () => {
      await service.delete('some-key');

      expect(mockPrismaService.storedFile.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when the file exists', async () => {
      mockProvider.exists.mockResolvedValue(true);

      const result = await service.exists('some-key');

      expect(result).toBe(true);
      expect(mockProvider.exists).toHaveBeenCalledWith('some-key');
    });

    it('should return false when the file does not exist', async () => {
      mockProvider.exists.mockResolvedValue(false);

      const result = await service.exists('missing-key');

      expect(result).toBe(false);
    });
  });
});
