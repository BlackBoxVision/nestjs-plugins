import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
];

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

function createFileFilter(allowedTypes: string[]) {
  return (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `Invalid file type "${file.mimetype}". Allowed: ${allowedTypes.join(', ')}`,
        ),
        false,
      );
    }
  };
}

/**
 * Decorator for image file uploads.
 * Accepts JPEG, PNG, GIF, WebP, SVG, and AVIF files.
 * Default max file size: 10MB.
 */
export function ImageUpload(
  fieldName = 'file',
  maxSize = 10 * 1024 * 1024,
): MethodDecorator {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter: createFileFilter(IMAGE_MIME_TYPES),
      }),
    ),
  );
}

/**
 * Decorator for document file uploads.
 * Accepts PDF, Word, Excel, CSV, and plain text files.
 * Default max file size: 25MB.
 */
export function DocumentUpload(
  fieldName = 'file',
  maxSize = 25 * 1024 * 1024,
): MethodDecorator {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter: createFileFilter(DOCUMENT_MIME_TYPES),
      }),
    ),
  );
}

/**
 * Decorator for avatar/profile image uploads.
 * Accepts JPEG, PNG, and WebP files only.
 * Default max file size: 2MB.
 */
export function AvatarUpload(
  fieldName = 'file',
  maxSize = 2 * 1024 * 1024,
): MethodDecorator {
  const avatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter: createFileFilter(avatarTypes),
      }),
    ),
  );
}
