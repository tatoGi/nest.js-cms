// ─────────────────────────────────────────────────────────────
// File: src/modules/media/infrastructure/prisma-media.repository.ts
// ─────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { Prisma, Media } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaRepository, MediaFilters, MediaStats } from '../domain/media.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';

/**
 * MIME type groups for filtering by logical type.
 */
const MIME_TYPE_GROUPS: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
};

@Injectable()
export class PrismaMediaRepository extends MediaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ─── Read ──────────────────────────────────────────────────

  async findById(id: number): Promise<Media | null> {
    return this.prisma.media.findUnique({ where: { id, deletedAt: null } });
  }

  async findByIdIncludeDeleted(id: number): Promise<Media | null> {
    return this.prisma.media.findUnique({ where: { id } });
  }

  async findAll(filters?: MediaFilters): Promise<Media[]> {
    return this.prisma.media.findMany({
      where: this.buildWhere(filters),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPaginated(
    filters?: MediaFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Media>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const where = this.buildWhere(filters);

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Write ─────────────────────────────────────────────────

  async create(data: {
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
  }): Promise<Media> {
    return this.prisma.media.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        path: data.path,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
        width: data.width ?? null,
        height: data.height ?? null,
        legacyFolder: data.legacyFolder,
        folderId: data.folderId ?? null,
        tags: data.tags ?? [],
        alt: data.alt ?? null,
        caption: data.caption ?? null,
      },
    });
  }

  async update(
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
  ): Promise<Media> {
    return this.prisma.media.update({
      where: { id },
      data,
    });
  }

  async findByUrl(url: string): Promise<Media | null> {
    return this.prisma.media.findFirst({ where: { url, deletedAt: null } });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: number): Promise<Media> {
    return this.prisma.media.update({ where: { id }, data: { deletedAt: null } });
  }

  async hardDelete(id: number): Promise<void> {
    await this.prisma.media.delete({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.softDelete(id);
  }

  async updatePathPrefix(oldChain: string, newChain: string): Promise<number> {
    const oldSegment = `cms/${oldChain}/`;
    const newSegment = `cms/${newChain}/`;
    const likePattern = `%${oldSegment}%`;

    const result = await this.prisma.$executeRaw`
      UPDATE media
      SET
        path = REPLACE(path, ${oldSegment}, ${newSegment}),
        url  = REPLACE(url,  ${oldSegment}, ${newSegment})
      WHERE path LIKE ${likePattern}
        AND scope = 'cms'
    `;

    return result as number;
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getStats(): Promise<MediaStats> {
    const [totalAgg, byMimeType, byFolder] = await Promise.all([
      this.prisma.media.aggregate({
        _count: { id: true },
        _sum: { size: true },
      }),

      this.prisma.media.groupBy({
        by: ['mimeType'],
        _count: { id: true },
        _sum: { size: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      this.prisma.media.groupBy({
        by: ['legacyFolder'],
        _count: { id: true },
        _sum: { size: true },
        orderBy: { legacyFolder: 'asc' },
      }),
    ]);

    return {
      totalFiles: totalAgg._count.id,
      totalSize: totalAgg._sum.size ?? 0,
      groupedByMimeType: byMimeType.map((row) => ({
        mimeType: row.mimeType,
        count: row._count.id,
        totalSize: row._sum.size ?? 0,
      })),
      groupedByFolder: byFolder.map((row) => ({
        folder: row.legacyFolder,
        count: row._count.id,
        totalSize: row._sum.size ?? 0,
      })),
    };
  }

  // ─── Private helpers ───────────────────────────────────────

  private buildWhere(filters?: MediaFilters): Prisma.MediaWhereInput {
    if (!filters) return { deletedAt: null };

    const where: Prisma.MediaWhereInput = {
      deletedAt: filters.deleted ? { not: null } : null,
    };

    if (filters.folderId) {
      where.folderId = filters.folderId;
    } else if (filters.folder) {
      where.legacyFolder = filters.folder;
    }

    if (filters.mimeType) {
      where.mimeType = filters.mimeType;
    }

    if (filters.type && MIME_TYPE_GROUPS[filters.type]) {
      where.mimeType = { in: MIME_TYPE_GROUPS[filters.type] };
    }

    if (filters.search) {
      where.OR = [
        { originalName: { contains: filters.search, mode: 'insensitive' } },
        { filename: { contains: filters.search, mode: 'insensitive' } },
        { alt: { contains: filters.search, mode: 'insensitive' } },
        { caption: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } },
      ];
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): Prisma.MediaOrderByWithRelationInput {
    if (pagination?.sortBy) {
      return { [pagination.sortBy]: pagination.sortOrder ?? 'desc' };
    }
    return { createdAt: 'desc' };
  }
}
