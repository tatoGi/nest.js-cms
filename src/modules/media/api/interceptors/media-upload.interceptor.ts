// ─────────────────────────────────────────────────────────────
// File: src/modules/media/api/interceptors/media-upload.interceptor.ts
// ─────────────────────────────────────────────────────────────

import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

/**
 * Max file size: 5MB.
 * Uses memory storage so the file buffer is available for
 * validation and processing before writing to disk.
 *
 * Further validation (MIME type, extension, double-extension,
 * path traversal) is handled by StorageService.validateFile().
 */
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

/**
 * Single file upload interceptor.
 * Field name: "file"
 *
 * Usage:
 *   @UseInterceptors(SingleFileUploadInterceptor)
 *   async upload(@UploadedFile() file: Express.Multer.File) { ... }
 */
export const SingleFileUploadInterceptor = FileInterceptor('file', multerOptions);

/**
 * Multiple file upload interceptor.
 * Field name: "files", max 10 files.
 *
 * Usage:
 *   @UseInterceptors(MultiFileUploadInterceptor)
 *   async upload(@UploadedFiles() files: Express.Multer.File[]) { ... }
 */
export const MultiFileUploadInterceptor = FilesInterceptor('files', 10, multerOptions);
