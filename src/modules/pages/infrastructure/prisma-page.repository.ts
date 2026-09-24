// src/modules/pages/infrastructure/prisma-page.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Page, Prisma } from '@prisma/client';
import { IPageRepository, PageFilters, CreatePageData, UpdatePageData } from '../domain';
import { PaginationOptions } from '@/common/pagination';

@Injectable()
export class PrismaPageRepository implements IPageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private buildWhere(filters?: PageFilters): Prisma.PageWhereInput {
    if (!filters) return {};

    const where: Prisma.PageWhereInput = {};

    if (filters.parentId !== undefined) where.parentId = filters.parentId;
    if (filters.templateId !== undefined) where.templateId = filters.templateId;
    if (filters.published !== undefined) where.published = filters.published;
    if (filters.showInMenu !== undefined) where.showInMenu = filters.showInMenu;
    if (filters.isHome !== undefined) where.isHome = filters.isHome;
    if (filters.createdById !== undefined) where.createdById = filters.createdById;
    if (filters.updatedById !== undefined) where.updatedById = filters.updatedById;

    if (filters.searchTerm) {
      where.translations = {
        some: {
          OR: [
            { title: { contains: filters.searchTerm, mode: 'insensitive' } },
            { slug: { contains: filters.searchTerm, mode: 'insensitive' } },
          ],
        },
      };
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): Prisma.PageOrderByWithRelationInput[] {
    if (!pagination?.sortBy) {
      return [{ sortOrder: 'asc' }, { id: 'asc' }];
    }

    const order = pagination.sortOrder || 'asc';
    return [{ [pagination.sortBy]: order }];
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  async findAll(filters?: PageFilters, pagination?: PaginationOptions): Promise<Page[]> {
    return this.prisma.page.findMany({
      where: this.buildWhere(filters),
      orderBy: this.buildOrderBy(pagination),
      skip:
        pagination?.page && pagination?.limit
          ? (pagination.page - 1) * pagination.limit
          : undefined,
      take: pagination?.limit,
    });
  }

  async findById(id: number): Promise<Page | null> {
    return this.prisma.page.findUnique({ where: { id } });
  }

  async findByParentId(parentId: number | null): Promise<Page[]> {
    return this.prisma.page.findMany({
      where: { parentId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  async create(data: CreatePageData): Promise<Page> {
    return this.prisma.page.create({
      data: {
        parentId: data.parentId ?? null,
        templateId: data.templateId,
        sortOrder: data.sortOrder ?? 0,
        published: data.published ?? false,
        showInMenu: data.showInMenu ?? false,
        isHome: data.isHome ?? false,
        featureImageId: data.featureImageId ?? null,
        createdById: data.createdById ?? null,
      },
    });
  }

  async update(id: number, data: UpdatePageData): Promise<Page> {
    return this.prisma.page.update({
      where: { id },
      data: {
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.showInMenu !== undefined && { showInMenu: data.showInMenu }),
        ...(data.isHome !== undefined && { isHome: data.isHome }),
        ...(data.featureImageId !== undefined && { featureImageId: data.featureImageId }),
        ...(data.updatedById !== undefined && { updatedById: data.updatedById }),
      },
    });
  }

  async delete(id: number): Promise<Page> {
    return this.prisma.page.delete({ where: { id } });
  }

  async softDelete(id: number): Promise<Page> {
    // For pages, we don't have deletedAt on Page itself
    // But we can soft-delete all translations
    await this.prisma.pageTranslation.updateMany({
      where: { pageId: id },
      data: { deletedAt: new Date() },
    });

    return this.prisma.page.findUniqueOrThrow({ where: { id } });
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  async count(filters?: PageFilters): Promise<number> {
    return this.prisma.page.count({ where: this.buildWhere(filters) });
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.prisma.page.count({ where: { id } });
    return count > 0;
  }
}
