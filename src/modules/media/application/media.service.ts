// ─────────────────────────────────────────────────────────────
// File: src/modules/media/application/media.service.ts
// ─────────────────────────────────────────────────────────────

import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { MediaNotFoundException, InvalidFileException } from '@/common/exceptions';
import { MediaRepository, MediaFilters } from '../domain/media.repository';
import { StorageService } from '../infrastructure/storage.service';
import {
  UploadMediaDto,
  UpdateMediaDto,
  MediaResponseDto,
  MediaStatsResponseDto,
  MediaPaginatedQueryDto,
} from '../dto';

import { PaginationOptions } from '@/common/pagination';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { MediaPermissions } from './media.permissions';
import { MediaFoldersService } from './media-folders.service';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly foldersService: MediaFoldersService,
  ) {}

  // ─── Upload ────────────────────────────────────────────────

  /**
   * Validates, stores, and creates a DB record for the uploaded file.
   */
  async upload(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    meta?: ActionMeta,
  ): Promise<MediaResponseDto> {
    // 1. Validate file (includes magic byte verification)
    const validationError = await this.storageService.validateFile(file);
    if (validationError) {
      throw new InvalidFileException(validationError);
    }

    // 2. Resolve folder path: structured folderId takes priority over legacy string
    let folder = dto.folder || 'general';
    let resolvedFolderId: number | null = null;

    if (dto.folderId) {
      const breadcrumbs = await this.foldersService.getBreadcrumbs(dto.folderId);
      folder = breadcrumbs.map((b) => b.slug).join('/');
      resolvedFolderId = dto.folderId;
    }

    const storageResult = await this.storageService.saveFile(file, folder);

    // 3. Create DB record
    const media = await this.mediaRepo.create({
      filename: storageResult.filename,
      originalName: file.originalname,
      path: storageResult.path,
      url: storageResult.url,
      mimeType: file.mimetype,
      size: file.size,
      width: storageResult.width,
      height: storageResult.height,
      legacyFolder: folder,
      folderId: resolvedFolderId,
      tags: dto.tags ?? [],
      alt: dto.alt ?? null,
      caption: dto.caption ?? null,
    });

    this.logger.log(`Uploaded media #${media.id}: ${file.originalname} → ${storageResult.url}`);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.UPLOAD_MEDIA,
      targetType: 'media',
      targetId: media.id,
      after: { filename: media.filename, originalName: media.originalName, url: media.url, folder },
      ip: meta?.ip,
    });

    return MediaResponseDto.fromEntity(media);
  }

  /**
   * Bulk upload: validates and stores multiple files.
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    dto: UploadMediaDto,
    meta?: ActionMeta,
  ): Promise<MediaResponseDto[]> {
    const results: MediaResponseDto[] = [];

    for (const file of files) {
      const result = await this.upload(file, dto, meta);
      results.push(result);
    }

    return results;
  }

  // ─── List (paginated) ──────────────────────────────────────

  async findAllPaginated(
    query: MediaPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<MediaResponseDto>> {
    const filters = this.mapQueryToFilters(query);

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.mediaRepo.findPaginated(filters, paginationOptions);

    return new PaginatedResponseDto<MediaResponseDto>(
      MediaResponseDto.fromEntities(result.data),
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  // ─── Get by ID ─────────────────────────────────────────────

  async findById(id: number): Promise<MediaResponseDto> {
    const media = await this.mediaRepo.findById(id);

    if (!media) {
      throw new MediaNotFoundException(id);
    }

    return MediaResponseDto.fromEntity(media);
  }

  // ─── Download ──────────────────────────────────────────────

  async download(
    id: number,
  ): Promise<{ stream: StreamableFile; filename: string; mimeType: string }> {
    const media = await this.mediaRepo.findById(id);

    if (!media) {
      throw new MediaNotFoundException(id);
    }

    const readStream = await this.storageService.createReadStream(media.path);

    return {
      stream: new StreamableFile(readStream),
      filename: media.originalName,
      mimeType: media.mimeType,
    };
  }

  // ─── Update metadata ──────────────────────────────────────

  async update(id: number, dto: UpdateMediaDto, meta?: ActionMeta): Promise<MediaResponseDto> {
    const existing = await this.mediaRepo.findById(id);

    if (!existing) {
      throw new MediaNotFoundException(id);
    }

    const updateData: Partial<{
      legacyFolder: string;
      folderId: number | null;
      tags: string[];
      alt: string | null;
      caption: string | null;
      path: string;
      url: string;
    }> = {};

    if (dto.folderId !== undefined && dto.folderId !== existing.folderId) {
      if (dto.folderId !== null) {
        const breadcrumbs = await this.foldersService.getBreadcrumbs(dto.folderId);
        const chain = breadcrumbs.map((b) => b.slug).join('/');
        const moved = await this.storageService.moveFile(existing.path, chain);
        updateData.folderId = dto.folderId;
        updateData.legacyFolder = breadcrumbs[breadcrumbs.length - 1].slug;
        updateData.path = moved.path;
        updateData.url = moved.url;
      } else {
        const moved = await this.storageService.moveFile(existing.path, 'general');
        updateData.folderId = null;
        updateData.legacyFolder = 'general';
        updateData.path = moved.path;
        updateData.url = moved.url;
      }
    } else if (dto.folder !== undefined && dto.folder !== existing.legacyFolder) {
      const moved = await this.storageService.moveFile(existing.path, dto.folder);
      updateData.legacyFolder = dto.folder;
      updateData.path = moved.path;
      updateData.url = moved.url;
    } else if (dto.folder !== undefined) {
      updateData.legacyFolder = dto.folder;
    }

    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.alt !== undefined) updateData.alt = dto.alt;
    if (dto.caption !== undefined) updateData.caption = dto.caption;

    const updated = await this.mediaRepo.update(id, updateData);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.UPDATE_MEDIA,
      targetType: 'media',
      targetId: id,
      before: {
        folder: existing.legacyFolder,
        scope: existing.scope,
        tags: existing.tags,
        alt: existing.alt,
        caption: existing.caption,
      },
      after: {
        folder: updated.legacyFolder,
        scope: updated.scope,
        tags: updated.tags,
        alt: updated.alt,
        caption: updated.caption,
      },
      ip: meta?.ip,
    });

    return MediaResponseDto.fromEntity(updated);
  }

  // ─── List folders ──────────────────────────────────────────

  async listFolders(): Promise<
    { folder: string; count: number; totalSize: number; totalSizeFormatted: string }[]
  > {
    const [diskFolders, stats] = await Promise.all([
      this.storageService.listFolderNames(),
      this.mediaRepo.getStats(),
    ]);

    const dbMap = new Map(stats.groupedByFolder.map((f) => [f.folder, f]));

    // Union of disk folders and DB folders
    const allFolders = new Set([...diskFolders, ...stats.groupedByFolder.map((f) => f.folder)]);

    return [...allFolders].sort().map((name) => {
      const db = dbMap.get(name);
      const totalSize = db?.totalSize ?? 0;
      return {
        folder: name,
        count: db?.count ?? 0,
        totalSize,
        totalSizeFormatted: MediaStatsResponseDto.formatBytes(totalSize),
      };
    });
  }

  // ─── Create folder ─────────────────────────────────────────

  async createFolder(name: string, meta?: ActionMeta): Promise<{ folder: string }> {
    const folder = await this.storageService.createFolder(name);
    this.logger.log(`Created folder: ${folder}`);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.UPLOAD_MEDIA,
      targetType: 'media_folder',
      after: { folder },
      ip: meta?.ip,
    });
    return { folder };
  }

  // ─── Soft delete / restore / hard delete ──────────────────

  // ─── Soft delete / restore / hard delete ──────────────────

  /**
   * Soft-deletes a media record — sets deletedAt, keeps file on disk.
   * FK relations are preserved so the image can be restored.
   */
  async softDelete(id: number, meta?: ActionMeta): Promise<void> {
    const media = await this.mediaRepo.findById(id);
    if (!media) throw new MediaNotFoundException(id);

    await this.mediaRepo.softDelete(id);
    this.logger.log(`Soft-deleted media #${id}: ${media.originalName}`);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.DELETE_MEDIA,
      targetType: 'media',
      targetId: id,
      before: { originalName: media.originalName, url: media.url },
      ip: meta?.ip,
    });
  }

  /**
   * Restores a soft-deleted media record.
   */
  async restore(id: number, meta?: ActionMeta): Promise<MediaResponseDto> {
    const media = await this.mediaRepo.restore(id);
    this.logger.log(`Restored media #${id}: ${media.originalName}`);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.DELETE_MEDIA,
      targetType: 'media',
      targetId: id,
      after: { originalName: media.originalName, url: media.url },
      ip: meta?.ip,
    });

    return MediaResponseDto.fromEntity(media);
  }

  /**
   * Permanently deletes file from disk and removes DB record.
   * Should only be called on already soft-deleted records (trash).
   */
  async hardDelete(id: number, meta?: ActionMeta): Promise<void> {
    // Use findByIdIncludeDeleted so we can hard-delete trashed records
    const media = await this.mediaRepo.findByIdIncludeDeleted(id);

    if (!media) throw new MediaNotFoundException(id);

    await this.storageService.deleteFile(media.path);
    await this.mediaRepo.hardDelete(id);
    this.logger.log(`Hard-deleted media #${id}: ${media.originalName}`);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.DELETE_MEDIA,
      targetType: 'media',
      targetId: id,
      before: { filename: media.filename, originalName: media.originalName, url: media.url },
      ip: meta?.ip,
    });
  }

  // ─── Delete ────────────────────────────────────────────────

  /**
   * Soft-deletes a media record by URL.
   */
  async deleteByUrl(url: string, meta?: ActionMeta): Promise<void> {
    const media = await this.mediaRepo.findByUrl(url);
    if (!media) return;

    await this.mediaRepo.softDelete(media.id);
    this.logger.log(`Soft-deleted media by URL: ${url}`);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: MediaPermissions.DELETE_MEDIA,
      targetType: 'media',
      targetId: media.id,
      before: { url, originalName: media.originalName, scope: media.scope },
      ip: meta?.ip,
    });
  }

  /**
   * Soft-deletes by ID (keeps file on disk, restorable).
   */
  async delete(id: number, meta?: ActionMeta): Promise<void> {
    return this.softDelete(id, meta);
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getStats(): Promise<MediaStatsResponseDto> {
    const stats = await this.mediaRepo.getStats();

    return {
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
      totalSizeFormatted: MediaStatsResponseDto.formatBytes(stats.totalSize),
      groupedByMimeType: stats.groupedByMimeType.map((row) => ({
        ...row,
        totalSizeFormatted: MediaStatsResponseDto.formatBytes(row.totalSize),
      })),
      groupedByFolder: stats.groupedByFolder.map((row) => ({
        ...row,
        totalSizeFormatted: MediaStatsResponseDto.formatBytes(row.totalSize),
      })),
    };
  }

  // ─── Private helpers ───────────────────────────────────────

  private mapQueryToFilters(query: MediaPaginatedQueryDto): MediaFilters {
    const filters: MediaFilters = {};

    if (query.search) filters.search = query.search;
    if (query.folderId) filters.folderId = query.folderId;
    if (query.folder) filters.folder = query.folder;
    if (query.type) filters.type = query.type;
    if (query.mimeType) filters.mimeType = query.mimeType;
    if (query.deleted) filters.deleted = query.deleted;

    return filters;
  }
}
