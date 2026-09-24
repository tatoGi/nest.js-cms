// ─────────────────────────────────────────────────────────────
// File: src/modules/media/dto/media-response.dto.ts
// ─────────────────────────────────────────────────────────────

import { Media } from '@prisma/client';

export class MediaResponseDto {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string;
  tags: string[];
  alt: string | null;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  /**
   * Maps a Prisma Media entity to a clean response DTO.
   */
  static fromEntity(entity: Media): MediaResponseDto {
    return {
      id: entity.id,
      filename: entity.filename,
      originalName: entity.originalName,
      path: entity.path,
      url: entity.url,
      mimeType: entity.mimeType,
      size: entity.size,
      width: entity.width,
      height: entity.height,
      folder: entity.legacyFolder,
      tags: entity.tags,
      alt: entity.alt,
      caption: entity.caption,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    };
  }

  /**
   * Maps an array of Prisma Media entities to response DTOs.
   */
  static fromEntities(entities: Media[]): MediaResponseDto[] {
    return entities.map((e) => MediaResponseDto.fromEntity(e));
  }
}

/**
 * Minimal media object embedded inside aggregate responses (pages, posts, etc.)
 */
export class MediaEmbedDto {
  id: number;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
}

export class MediaStatsResponseDto {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  groupedByMimeType: {
    mimeType: string;
    count: number;
    totalSize: number;
    totalSizeFormatted: string;
  }[];
  groupedByFolder: {
    folder: string;
    count: number;
    totalSize: number;
    totalSizeFormatted: string;
  }[];

  /**
   * Formats bytes into a human-readable string.
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }
}
