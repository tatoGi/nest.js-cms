// ─────────────────────────────────────────────────────────────
// File: src/modules/media/infrastructure/storage.service.ts
// ─────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { MediaFileNotFoundException } from '@/common/exceptions';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

export type StorageResult = {
  filename: string;
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /**
   * Base directory for all uploads.
   * Configure via UPLOAD_DIR env or defaults to ./uploads
   */
  private readonly uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  /**
   * Public URL prefix for serving files.
   * Configure via UPLOAD_URL_PREFIX env or defaults to /uploads
   */
  private readonly urlPrefix = process.env.UPLOAD_URL_PREFIX || '/uploads';

  // ─── Allowed MIME types & extensions ───────────────────────

  private readonly ALLOWED_MIME_TYPES = new Set([
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Video
    'video/mp4',
    'video/webm',
    // PDF
    'application/pdf',
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);

  private readonly ALLOWED_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.mp4',
    '.webm',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
  ]);

  /**
   * Office MIME types whose magic bytes are detected as OLE Compound (x-cfb)
   * or ZIP (OOXML) by file-type — both are valid binary containers for Office files.
   */
  private readonly OFFICE_MIME_TYPES = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);

  /** Detected MIME types that are valid containers for Office files. */
  private readonly OFFICE_CONTAINER_MIMES = new Set([
    'application/x-cfb', // OLE Compound — .doc, .xls, .ppt
    'application/zip', // OOXML fallback — .docx, .xlsx, .pptx
  ]);

  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB (documents can be large)

  // ─── Validation ────────────────────────────────────────────

  /**
   * Validates file against whitelist rules.
   * Returns error message string or null if valid.
   *
   * Validation order:
   * 1. File size limit
   * 2. Client MIME type whitelist
   * 3. Extension whitelist
   * 4. Double extension rejection
   * 5. Path traversal prevention
   * 6. Magic byte verification (actual file content)
   */
  async validateFile(file: Express.Multer.File): Promise<string | null> {
    // 1. Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // 2. Check client-provided MIME type
    if (!this.ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return `MIME type "${file.mimetype}" is not allowed. Allowed types: ${[...this.ALLOWED_MIME_TYPES].join(', ')}`;
    }

    // 3. Extract and check extension
    const ext = this.getExtension(file.originalname);

    if (!ext || !this.ALLOWED_EXTENSIONS.has(ext)) {
      return `File extension "${ext || 'none'}" is not allowed. Allowed extensions: ${[...this.ALLOWED_EXTENSIONS].join(', ')}`;
    }

    // 4. Reject double extensions (e.g. "file.php.jpg")
    const parts = file.originalname.split('.');
    if (parts.length > 2) {
      const suspiciousExts = [
        '.php',
        '.js',
        '.html',
        '.htm',
        '.exe',
        '.sh',
        '.bat',
        '.cmd',
        '.ps1',
      ];
      for (let i = 0; i < parts.length - 1; i++) {
        const checkExt = `.${parts[i].toLowerCase()}`;
        if (suspiciousExts.includes(checkExt)) {
          return `Suspicious double extension detected in filename "${file.originalname}"`;
        }
      }
    }

    // 5. Reject path traversal attempts
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\')
    ) {
      return 'Filename contains invalid characters (path traversal attempt)';
    }

    // 6. Magic byte verification — check actual file content
    //    This catches cases where someone renames malware.exe → image.jpg
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);

    // SVG is XML-based and has no magic bytes — skip detection for SVG
    if (file.mimetype === 'image/svg+xml') {
      // Basic SVG sanity check: must contain <svg tag
      const head = file.buffer.subarray(0, 4096).toString('utf-8');
      if (!head.includes('<svg')) {
        return 'File claims to be SVG but does not contain valid SVG markup';
      }

      // Block embedded scripts in SVG (XSS vector)
      if (/<script[\s>]/i.test(head) || /on\w+\s*=/i.test(head)) {
        return 'SVG file contains embedded scripts which are not allowed';
      }

      return null;
    }

    // Special case: Office files
    // .doc/.xls/.ppt  → OLE Compound → file-type returns "application/x-cfb"
    // .docx/.xlsx/.pptx → OOXML (ZIP) → file-type returns "application/zip"
    // Both are valid containers for Office files — accept them.
    if (this.OFFICE_MIME_TYPES.has(file.mimetype)) {
      if (!detected) {
        return 'Unable to determine file type from content. File may be corrupted or disguised';
      }
      if (
        !this.OFFICE_CONTAINER_MIMES.has(detected.mime) &&
        !this.OFFICE_MIME_TYPES.has(detected.mime)
      ) {
        return `File content does not appear to be a valid Office document (detected: ${detected.mime})`;
      }
      return null;
    }

    // For all other types, magic bytes must be present and match
    if (!detected) {
      return 'Unable to determine file type from content. File may be corrupted or disguised';
    }

    if (!this.ALLOWED_MIME_TYPES.has(detected.mime)) {
      return `File content signature (${detected.mime}) does not match an allowed type. Declared type was "${file.mimetype}"`;
    }

    // Cross-check: declared MIME type should roughly match detected type
    // e.g., don't allow declaring "image/png" when content is "application/pdf"
    const declaredGroup = file.mimetype.split('/')[0];
    const detectedGroup = detected.mime.split('/')[0];
    if (declaredGroup !== detectedGroup) {
      return `File type mismatch: declared as "${file.mimetype}" but content is "${detected.mime}"`;
    }

    return null;
  }

  // ─── File storage ──────────────────────────────────────────

  /**
   * Saves file to disk.
   *
   * Folder structure: uploads/{folder}/{uuid}.{ext}
   */
  async saveFile(file: Express.Multer.File, folder: string = 'general'): Promise<StorageResult> {
    const ext = this.getExtension(file.originalname) || '.bin';
    const filename = `${uuidv4()}${ext}`;
    const safeFolder = this.sanitizeFolderChain(folder);

    const dirPath = path.join(this.uploadDir, ...safeFolder.split('/'));
    const relativePath = `${safeFolder}/${filename}`;

    await fsp.mkdir(dirPath, { recursive: true });
    await fsp.writeFile(path.join(dirPath, filename), file.buffer);

    this.logger.log(
      `Saved file: ${file.originalname} → ${relativePath} (${(file.size / 1024).toFixed(1)}KB)`,
    );

    // Extract image dimensions
    let width: number | null = null;
    let height: number | null = null;

    if (this.isImage(file.mimetype)) {
      const dimensions = await this.getImageDimensions(file.buffer);
      width = dimensions.width;
      height = dimensions.height;
    }

    return {
      filename,
      path: relativePath,
      url: `${this.urlPrefix}/${relativePath}`,
      width,
      height,
    };
  }

  /**
   * Deletes file from disk by relative path.
   * Fails silently if file doesn't exist (already deleted).
   */
  async deleteFile(relativePath: string): Promise<void> {
    // Prevent path traversal
    if (relativePath.includes('..')) {
      this.logger.warn(`Path traversal attempt blocked: ${relativePath}`);
      return;
    }

    const fullPath = path.join(this.uploadDir, relativePath);

    try {
      await fsp.access(fullPath);
      await fsp.unlink(fullPath);
      this.logger.log(`Deleted file: ${fullPath}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`File not found (already deleted?): ${fullPath}`);
      } else {
        this.logger.error(`Failed to delete file: ${fullPath}`, error.stack);
        throw error;
      }
    }
  }

  /**
   * Checks if a file exists on disk.
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, relativePath);
    try {
      await fsp.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the absolute disk path for a relative media path.
   * Blocks path traversal attempts.
   */
  getAbsolutePath(relativePath: string): string {
    if (relativePath.includes('..')) {
      throw new Error('Path traversal attempt blocked');
    }
    return path.join(this.uploadDir, relativePath);
  }

  /**
   * Returns all unique subfolder names found inside cms/ across all year directories.
   * Returns an empty array if no cms folders exist yet.
   */
  async listFolderNames(): Promise<string[]> {
    const names = new Set<string>();

    try {
      const entries = await fsp.readdir(this.uploadDir);
      for (const entry of entries) {
        const entryPath = path.join(this.uploadDir, entry);
        try {
          const stat = await fsp.stat(entryPath);
          if (stat.isDirectory()) names.add(entry);
        } catch {
          continue;
        }
      }
    } catch {
      // uploadDir doesn't exist yet
    }

    return [...names].sort();
  }

  /**
   * Creates a subfolder inside cms/.
   * Returns the sanitized name actually used.
   */
  async createFolder(name: string): Promise<string> {
    const safeName = this.sanitizeFolderName(name);
    const dirPath = path.join(this.uploadDir, safeName);
    await fsp.mkdir(dirPath, { recursive: true });
    this.logger.log(`Created folder: ${dirPath}`);
    return safeName;
  }

  /**
   * Moves a CMS file to a different CMS subfolder.
   * Only moves files within cms/ — site/ files are immutable once published.
   *
   * Expected relativePath format: "{year}/cms/{subfolder}/{filename}"
   */
  /**
   * Moves a CMS file to a different folder.
   * newFolderChain can be a flat name ("pages") or nested slug chain ("pages/hero-images").
   * Only moves files within cms/ — site/ files are immutable once published.
   *
   * Expected relativePath format: "{year}/cms/{...chain}/{filename}"
   */
  async moveFile(
    relativePath: string,
    newFolderChain: string,
  ): Promise<{ path: string; url: string }> {
    if (relativePath.includes('..') || newFolderChain.includes('..')) {
      throw new Error('Path traversal attempt blocked');
    }

    const parts = relativePath.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid path for moveFile: ${relativePath}`);
    }

    const filename = parts[parts.length - 1];
    const safeChain = this.sanitizeFolderChain(newFolderChain);

    let oldFullPath = path.join(this.uploadDir, relativePath);

    try {
      await fsp.access(oldFullPath);
    } catch {
      // Path in DB doesn't match disk (legacy mismatch). Search by filename.
      const found = await this.findFileOnDisk(filename);
      if (!found) {
        throw new Error(`File not found: ${filename} (stored path: ${relativePath})`);
      }
      this.logger.warn(`Path mismatch — found ${filename} at ${found} (DB had ${relativePath})`);
      oldFullPath = found;
    }

    const newDirPath = path.join(this.uploadDir, ...safeChain.split('/'));
    const newFullPath = path.join(newDirPath, filename);

    await fsp.mkdir(newDirPath, { recursive: true });
    await fsp.rename(oldFullPath, newFullPath);

    const newRelativePath = `${safeChain}/${filename}`;
    const newUrl = `${this.urlPrefix}/${newRelativePath}`;

    this.logger.log(`Moved CMS file: ${relativePath} → ${newRelativePath}`);

    return { path: newRelativePath, url: newUrl };
  }

  /**
   * Moves a CMS folder (and all its contents) to a new slug chain path.
   * Operates across all year directories.
   *
   * oldChain / newChain are relative to cms/, e.g. "pages/hero-images"
   */
  async moveCmsFolderOnDisk(oldChain: string, newChain: string): Promise<void> {
    if (oldChain.includes('..') || newChain.includes('..')) {
      throw new Error('Path traversal attempt blocked');
    }

    const oldDirPath = path.join(this.uploadDir, ...oldChain.split('/'));
    const newDirPath = path.join(this.uploadDir, ...newChain.split('/'));

    try {
      await fsp.access(oldDirPath);
      await fsp.mkdir(path.dirname(newDirPath), { recursive: true });
      await fsp.rename(oldDirPath, newDirPath);
      this.logger.log(`Moved folder: ${oldDirPath} → ${newDirPath}`);
    } catch {
      // folder doesn't exist — nothing to move
    }
  }

  /**
   * Creates a readable stream for a file stored at a relative path.
   * Throws NotFoundException if the file does not exist on disk.
   */
  async createReadStream(relativePath: string): Promise<fs.ReadStream> {
    const fullPath = this.getAbsolutePath(relativePath);

    try {
      await fsp.access(fullPath);
    } catch {
      throw new MediaFileNotFoundException(relativePath);
    }

    return fs.createReadStream(fullPath);
  }

  // ─── Private helpers ───────────────────────────────────────

  /**
   * Recursively searches uploadDir for a file by exact filename.
   * Used as a fallback when the path stored in DB doesn't match the real disk location.
   */
  private async findFileOnDisk(filename: string): Promise<string | null> {
    const search = async (dir: string): Promise<string | null> => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return null;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === filename) return fullPath;
        if (entry.isDirectory()) {
          const found = await search(fullPath);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.uploadDir);
  }

  /**
   * Extracts lowercase extension from filename.
   */
  private getExtension(filename: string): string | null {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filename.length - 1) return null;
    return filename.slice(lastDot).toLowerCase();
  }

  /**
   * Sanitizes a single folder name segment.
   * Only allows alphanumeric, hyphens, underscores.
   */
  private sanitizeFolderName(folder: string): string {
    const sanitized = folder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
    return sanitized || 'general';
  }

  /**
   * Sanitizes a folder chain (e.g. "pages/hero-images") by sanitizing each segment.
   * Allows forward slashes as separators.
   */
  private sanitizeFolderChain(chain: string): string {
    const parts = chain
      .split('/')
      .map((s) => this.sanitizeFolderName(s))
      .filter(Boolean);
    return parts.length > 0 ? parts.join('/') : 'general';
  }

  /**
   * Checks if MIME type is an image type.
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
  }

  /**
   * Extracts width and height from image buffer using sharp.
   */
  private async getImageDimensions(
    buffer: Buffer,
  ): Promise<{ width: number | null; height: number | null }> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
      };
    } catch (error) {
      this.logger.warn('Failed to extract image dimensions', error);
      return { width: null, height: null };
    }
  }
}
