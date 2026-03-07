jest.mock('@nestjs/common', () => ({
  applyDecorators: jest.fn((...decorators: any[]) => decorators),
  UseInterceptors: jest.fn((interceptor: any) => ({ interceptor })),
}));

jest.mock('@nestjs/platform-express', () => ({
  FileInterceptor: jest.fn((fieldName: string, options: any) => ({
    fieldName,
    options,
  })),
}));

jest.mock('multer', () => ({
  memoryStorage: jest.fn().mockReturnValue('memory-storage'),
}));

import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImageUpload, DocumentUpload, AvatarUpload } from './file-upload.decorator';

describe('File Upload Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ImageUpload', () => {
    it('should use default fieldName "file" and maxSize 10MB', () => {
      ImageUpload();

      expect(FileInterceptor).toHaveBeenCalledWith('file', {
        storage: 'memory-storage',
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    it('should use custom fieldName and maxSize when provided', () => {
      ImageUpload('avatar', 5 * 1024 * 1024);

      expect(FileInterceptor).toHaveBeenCalledWith('avatar', {
        storage: 'memory-storage',
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    it('should use memoryStorage', () => {
      ImageUpload();

      expect(memoryStorage).toHaveBeenCalled();
    });

    it('should call applyDecorators with UseInterceptors', () => {
      ImageUpload();

      expect(applyDecorators).toHaveBeenCalled();
      expect(UseInterceptors).toHaveBeenCalled();
    });

    describe('fileFilter', () => {
      const validImageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/avif',
      ];

      let fileFilter: Function;

      beforeEach(() => {
        ImageUpload();
        const fileInterceptorCall = (FileInterceptor as jest.Mock).mock.calls[0];
        fileFilter = fileInterceptorCall[1].fileFilter;
      });

      it.each(validImageTypes)(
        'should accept %s mimetype',
        (mimetype) => {
          const callback = jest.fn();
          fileFilter({}, { mimetype }, callback);

          expect(callback).toHaveBeenCalledWith(null, true);
        },
      );

      it('should reject invalid mimetype with descriptive error', () => {
        const callback = jest.fn();
        fileFilter({}, { mimetype: 'application/pdf' }, callback);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid file type "application/pdf"'),
          }),
          false,
        );
      });

      it('should include allowed types in error message', () => {
        const callback = jest.fn();
        fileFilter({}, { mimetype: 'text/plain' }, callback);

        const error = callback.mock.calls[0][0];
        expect(error.message).toContain('image/jpeg');
        expect(error.message).toContain('image/png');
      });
    });
  });

  describe('DocumentUpload', () => {
    it('should use default fieldName "file" and maxSize 25MB', () => {
      DocumentUpload();

      expect(FileInterceptor).toHaveBeenCalledWith('file', {
        storage: 'memory-storage',
        limits: { fileSize: 25 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    it('should use custom fieldName and maxSize when provided', () => {
      DocumentUpload('document', 50 * 1024 * 1024);

      expect(FileInterceptor).toHaveBeenCalledWith('document', {
        storage: 'memory-storage',
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    describe('fileFilter', () => {
      const validDocumentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];

      let fileFilter: Function;

      beforeEach(() => {
        DocumentUpload();
        const fileInterceptorCall = (FileInterceptor as jest.Mock).mock.calls[0];
        fileFilter = fileInterceptorCall[1].fileFilter;
      });

      it.each(validDocumentTypes)(
        'should accept %s mimetype',
        (mimetype) => {
          const callback = jest.fn();
          fileFilter({}, { mimetype }, callback);

          expect(callback).toHaveBeenCalledWith(null, true);
        },
      );

      it('should reject image/jpeg for document upload', () => {
        const callback = jest.fn();
        fileFilter({}, { mimetype: 'image/jpeg' }, callback);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid file type "image/jpeg"'),
          }),
          false,
        );
      });
    });
  });

  describe('AvatarUpload', () => {
    it('should use default fieldName "file" and maxSize 2MB', () => {
      AvatarUpload();

      expect(FileInterceptor).toHaveBeenCalledWith('file', {
        storage: 'memory-storage',
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    it('should use custom fieldName and maxSize when provided', () => {
      AvatarUpload('profile_pic', 1 * 1024 * 1024);

      expect(FileInterceptor).toHaveBeenCalledWith('profile_pic', {
        storage: 'memory-storage',
        limits: { fileSize: 1 * 1024 * 1024 },
        fileFilter: expect.any(Function),
      });
    });

    describe('fileFilter', () => {
      const validAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const rejectedAvatarTypes = ['image/gif', 'image/svg+xml', 'image/avif'];

      let fileFilter: Function;

      beforeEach(() => {
        AvatarUpload();
        const fileInterceptorCall = (FileInterceptor as jest.Mock).mock.calls[0];
        fileFilter = fileInterceptorCall[1].fileFilter;
      });

      it.each(validAvatarTypes)(
        'should accept %s mimetype',
        (mimetype) => {
          const callback = jest.fn();
          fileFilter({}, { mimetype }, callback);

          expect(callback).toHaveBeenCalledWith(null, true);
        },
      );

      it.each(rejectedAvatarTypes)(
        'should reject %s mimetype for avatar upload',
        (mimetype) => {
          const callback = jest.fn();
          fileFilter({}, { mimetype }, callback);

          expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.stringContaining(`Invalid file type "${mimetype}"`),
            }),
            false,
          );
        },
      );

      it('should reject application/pdf for avatar upload', () => {
        const callback = jest.fn();
        fileFilter({}, { mimetype: 'application/pdf' }, callback);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid file type "application/pdf"'),
          }),
          false,
        );
      });
    });
  });
});
