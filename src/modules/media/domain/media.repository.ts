// ─────────────────────────────────────────────────────────────
// File: src/modules/media/domain/media.repository.ts
// ─────────────────────────────────────────────────────────────

import { Media } from '@prisma/client';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';

export type MediaFilters = {
  search?: string;
  folder?: string;
  folderId?: number;
  type?: 'image' | 'video' | 'document';
  mimeType?: string;
  /** When true, return only soft-deleted records. Default: false (active only). */
  deleted?: boolean;
};

export type MediaStats = {
  totalFiles: number;
  totalSize: number;
  groupedByMimeType: { mimeType: string; count: number; totalSize: number }[];
  groupedByFolder: { folder: string; count: number; totalSize: number }[];
};

export abstract class MediaRepository {
  abstract findById(id: number): Promise<Media | null>;
  abstract findByIdIncludeDeleted(id: number): Promise<Media | null>;
  abstract findAll(filters?: MediaFilters): Promise<Media[]>;
  abstract findPaginated(
    filters?: MediaFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Media>>;
  abstract create(data: {
    filename: string;
    originalName: string;
    path: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number | null;
    height?: number | null;
    legacyFolder: string;
    folderId?: number | null;
    tags?: string[];
    alt?: string | null;
    caption?: string | null;
  }): Promise<Media>;
  abstract update(
    id: number,
    data: Partial<{
      legacyFolder: string;
      folderId: number | null;
      tags: string[];
      alt: string | null;
      caption: string | null;
      path: string;
      url: string;
    }>,
  ): Promise<Media>;
  abstract findByUrl(url: string): Promise<Media | null>;
  abstract softDelete(id: number): Promise<void>;
  abstract restore(id: number): Promise<Media>;
  abstract hardDelete(id: number): Promise<void>;
  /** @deprecated use softDelete */
  abstract delete(id: number): Promise<void>;
  abstract getStats(): Promise<MediaStats>;
  /**
   * Bulk-updates path and url for all cms-scoped media whose path contains the old folder chain.
   * Used when a folder is renamed or moved.
   * Returns the number of affected rows.
   */
  abstract updatePathPrefix(oldChain: string, newChain: string): Promise<number>;
}
