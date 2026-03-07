import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

describe('StorageController', () => {
  let controller: StorageController;
  let mockStorageService: jest.Mocked<
    Pick<StorageService, 'upload' | 'delete' | 'getUrl' | 'exists'>
  >;

  beforeEach(async () => {
    mockStorageService = {
      upload: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      getUrl: jest
        .fn()
        .mockResolvedValue('https://cdn.example.com/signed/key'),
      exists: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

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

  describe('POST upload', () => {
    it('should call service.upload with the file and return result', async () => {
      const file = createMockFile();
      const expectedResult = {
        key: 'generated-key.png',
        url: 'https://cdn.example.com/generated-key.png',
        bucket: 'test-bucket',
        provider: 's3',
        mimeType: 'image/png',
        size: 1024,
        originalName: 'test-image.png',
      };
      mockStorageService.upload.mockResolvedValueOnce(expectedResult);

      const result = await controller.upload(file);

      expect(result).toEqual(expectedResult);
      expect(mockStorageService.upload).toHaveBeenCalledWith(file);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.upload(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.upload(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with descriptive message', async () => {
      try {
        await controller.upload(undefined as any);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'No file provided',
        );
      }
    });
  });

  describe('DELETE :key', () => {
    it('should call service.delete and return { deleted: true }', async () => {
      const result = await controller.delete('some-file-key');

      expect(mockStorageService.delete).toHaveBeenCalledWith('some-file-key');
      expect(result).toEqual({ deleted: true });
    });

    it('should propagate errors from service.delete', async () => {
      mockStorageService.delete.mockRejectedValueOnce(
        new Error('Delete failed'),
      );

      await expect(controller.delete('bad-key')).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('GET :key/url', () => {
    it('should call service.getUrl and return { url }', async () => {
      const result = await controller.getUrl('some-key');

      expect(mockStorageService.getUrl).toHaveBeenCalledWith('some-key', {});
      expect(result).toEqual({
        url: 'https://cdn.example.com/signed/key',
      });
    });

    it('should pass valid expiresIn as a number to service.getUrl', async () => {
      await controller.getUrl('some-key', '7200');

      expect(mockStorageService.getUrl).toHaveBeenCalledWith('some-key', {
        expiresIn: 7200,
      });
    });

    it('should throw BadRequestException for non-numeric expiresIn', async () => {
      await expect(
        controller.getUrl('some-key', 'not-a-number'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative expiresIn', async () => {
      await expect(
        controller.getUrl('some-key', '-100'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for zero expiresIn', async () => {
      await expect(controller.getUrl('some-key', '0')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with descriptive message for invalid expiresIn', async () => {
      try {
        await controller.getUrl('some-key', 'abc');
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'expiresIn must be a positive integer (seconds)',
        );
      }
    });

    it('should not set expiresIn when query param is undefined', async () => {
      await controller.getUrl('some-key', undefined);

      expect(mockStorageService.getUrl).toHaveBeenCalledWith('some-key', {});
    });
  });
});
