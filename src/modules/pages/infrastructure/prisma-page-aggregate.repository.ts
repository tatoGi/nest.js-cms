// src/modules/pages/infrastructure/prisma-page-aggregate.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { PageAggregate, PageSlugAlias, PageFilters, IPageAggregateRepository } from '../domain';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { PagePaginatedQueryDto } from '../dto';

// Helper function to safely convert Prisma JSON to object
function jsonToObject(json: Prisma.JsonValue): Record<string, any> {
  if (json === null || json === undefined) return {};
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, any>;
  }
  return {};
}

@Injectable()
export class PrismaPageAggregateRepository implements IPageAggregateRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private buildWhere(filters?: PageFilters): Prisma.PageWhereInput {
    if (!filters) return {};

    const where: Prisma.PageWhereInput = {
      deletedAt: null, // ✅ Default: only active pages
    };

    if (filters.parentId !== undefined) where.parentId = filters.parentId;
    if (filters.templateId !== undefined) where.templateId = filters.templateId;
    if (filters.published !== undefined) where.published = filters.published;
    if (filters.showInMenu !== undefined) where.showInMenu = filters.showInMenu;
    if (filters.isHome !== undefined) where.isHome = filters.isHome;

    if (filters.searchTerm) {
      where.translations = {
        some: {
          OR: [
            { title: { contains: filters.searchTerm, mode: 'insensitive' } },
            { slug: { contains: filters.searchTerm, mode: 'insensitive' } },
            { content: { contains: filters.searchTerm, mode: 'insensitive' } },
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

  private mapToAggregate(page: any): PageAggregate {
    return {
      id: page.id,
      parentId: page.parentId,
      templateId: page.templateId,
      sortOrder: page.sortOrder,
      published: page.published,
      showInMenu: page.showInMenu,
      isHome: page.isHome,
      featureImageId: page.featureImageId,
      featureImage: page.featureImage ?? null,
      createdById: page.createdById,
      updatedById: page.updatedById,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      deletedAt: page.deletedAt,
      templateData: page.template ?? null, // Map template relation if included

      translations: page.translations.map((t: any) => ({
        id: t.id,
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        subtitle: t.subtitle,
        excerpt: t.excerpt,
        content: t.content,
        description: t.description,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
        keywords: t.keywords,
        focusKeyword: t.focusKeyword,
        canonicalUrl: t.canonicalUrl,
        publishedAt: t.publishedAt,
        deletedAt: t.deletedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        language: t.language ?? null, // Map language relation if included

        blocks: t.blocks.map((b: any) => ({
          id: b.id,
          type: b.type,
          data: jsonToObject(b.data),
          sortOrder: b.sortOrder,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        })),
      })),

      slugAliases: page.slugAliases?.map((s: PageSlugAlias) => ({
        id: s.id,
        pageId: page.id,
        languageId: s.languageId,
        slug: s.slug,
        createdAt: s.createdAt,
      })),

      versions: page.versions?.map((v: any) => ({
        id: v.id,
        pageId: page.id,
        languageId: v.languageId,
        snapshot: jsonToObject(v.snapshot),
        createdAt: v.createdAt,
      })),
    };
  }

  private getFullInclude() {
    return {
      template: true, // ✅ include template
      featureImage: {
        select: {
          id: true,
          url: true,
          mimeType: true,
          width: true,
          height: true,
          alt: true,
          caption: true,
        },
      },

      translations: {
        where: { deletedAt: null },
        include: {
          language: true, // ✅ include language
          blocks: {
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },

      slugAliases: true,

      versions: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          language: true, // optional but recommended
        },
      },
      parent: {
        select: {
          id: true,
          sortOrder: true,
          translations: {
            where: { deletedAt: null },
            select: {
              title: true,
            },
          },
        },
      },
    };
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  async findById(id: number): Promise<PageAggregate | null> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!page) return null;
    return this.mapToAggregate(page);
  }

  async findBySlug(slug: string, languageId: number) {
    const translation = await this.prisma.pageTranslation.findFirst({
      where: { slug, languageId },
      select: { pageId: true },
    });

    if (translation) return this.findById(translation.pageId);

    const alias = await this.prisma.pageSlugAlias.findFirst({
      where: { slug, languageId },
      select: { pageId: true },
    });

    return alias ? this.findById(alias.pageId) : null;
  }

  async findAll(filters?: PageFilters, pagination?: PaginationOptions) {
    const pages = await this.prisma.page.findMany({
      where: this.buildWhere(filters),
      include: this.getFullInclude(),
      orderBy: this.buildOrderBy(pagination),
    });

    return pages.map((p) => this.mapToAggregate(p));
  }

  async findPaginated(filters?: PageFilters, pagination?: PaginationOptions) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const [data, total] = await Promise.all([
      this.prisma.page.findMany({
        where: this.buildWhere(filters),
        include: this.getFullInclude(),
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.page.count({ where: this.buildWhere(filters) }),
    ]);

    return {
      data: data.map((p) => this.mapToAggregate(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findChildren(parentId: number) {
    const pages = await this.prisma.page.findMany({
      where: { parentId, deletedAt: null },
      include: this.getFullInclude(),
    });

    return pages.map((p) => this.mapToAggregate(p));
  }

  async findDeleted(): Promise<PageAggregate[]> {
    const pages = await this.prisma.page.findMany({
      where: { deletedAt: { not: null } },
      include: this.getFullInclude(),
    });

    return pages.map((p) => this.mapToAggregate(p));
  }
  // ==========================================
  // WRITE OPERATIONS (Required by Interface)
  // ==========================================

  async create(page: PageAggregate, createdById?: number): Promise<PageAggregate> {
    return this.prisma.$transaction(async (tx) => {
      const createdPage = await tx.page.create({
        data: {
          parentId: page.parentId,
          templateId: page.templateId,
          sortOrder: page.sortOrder,
          published: page.published,
          showInMenu: page.showInMenu,
          isHome: page.isHome,
          featureImageId: page.featureImageId,
          createdById: createdById ?? page.createdById,
        },
      });

      // Create translations
      for (const t of page.translations) {
        const translation = await tx.pageTranslation.create({
          data: {
            pageId: createdPage.id,
            languageId: t.languageId,
            title: t.title,
            slug: t.slug,
            subtitle: t.subtitle,
            excerpt: t.excerpt,
            content: t.content,
            description: t.description,
            metaTitle: t.metaTitle,
            metaDescription: t.metaDescription,
            keywords: t.keywords,
            focusKeyword: t.focusKeyword,
            canonicalUrl: t.canonicalUrl,
            publishedAt: t.publishedAt,
          },
        });

        // Blocks
        if (t.blocks?.length) {
          await tx.pageContentBlock.createMany({
            data: t.blocks.map((b) => ({
              translationId: translation.id,
              type: b.type,
              data: b.data,
              sortOrder: b.sortOrder,
            })),
          });
        }
      }

      return (await this.findByIdInTransaction(tx, createdPage.id))!;
    });
  }

  async update(
    id: number,
    page: Partial<PageAggregate>,
    updatedById?: number,
  ): Promise<PageAggregate> {
    return this.prisma.$transaction(async (tx) => {
      await tx.page.update({
        where: { id },
        data: {
          ...(page.parentId !== undefined && { parentId: page.parentId }),
          ...(page.templateId !== undefined && { templateId: page.templateId }),
          ...(page.sortOrder !== undefined && { sortOrder: page.sortOrder }),
          ...(page.published !== undefined && { published: page.published }),
          ...(page.showInMenu !== undefined && { showInMenu: page.showInMenu }),
          ...(page.isHome !== undefined && { isHome: page.isHome }),
          ...(page.featureImageId !== undefined && {
            featureImageId: page.featureImageId,
          }),
          updatedById: updatedById ?? page.updatedById,
        },
      });

      // Upsert translations
      if (page.translations) {
        for (const t of page.translations) {
          const existingTranslation = await tx.pageTranslation.findUnique({
            where: {
              pageId_languageId: {
                pageId: id,
                languageId: t.languageId,
              },
            },
            select: {
              id: true,
              slug: true,
            },
          });

          if (existingTranslation && existingTranslation.slug !== t.slug) {
            await tx.pageSlugAlias.create({
              data: {
                pageId: id,
                languageId: t.languageId,
                slug: existingTranslation.slug,
              },
            });
          }

          const translation = await tx.pageTranslation.upsert({
            where: {
              pageId_languageId: {
                pageId: id,
                languageId: t.languageId,
              },
            },
            update: {
              title: t.title,
              slug: t.slug,
              subtitle: t.subtitle,
              excerpt: t.excerpt,
              content: t.content,
              description: t.description,
              metaTitle: t.metaTitle,
              metaDescription: t.metaDescription,
              keywords: t.keywords,
              focusKeyword: t.focusKeyword,
              canonicalUrl: t.canonicalUrl,
              publishedAt: t.publishedAt,
              deletedAt: null,
            },
            create: {
              pageId: id,
              languageId: t.languageId,
              title: t.title,
              slug: t.slug,
              subtitle: t.subtitle,
              excerpt: t.excerpt,
              content: t.content,
              description: t.description,
              metaTitle: t.metaTitle,
              metaDescription: t.metaDescription,
              keywords: t.keywords,
              focusKeyword: t.focusKeyword,
              canonicalUrl: t.canonicalUrl,
              publishedAt: t.publishedAt,
            },
          });

          if (t.slug && (!existingTranslation || existingTranslation.slug !== t.slug)) {
            const linkedMenuItems = await tx.menuItem.findMany({
              where: {
                type: 'page',
                referenceId: id,
              },
              select: { id: true },
            });

            if (linkedMenuItems.length > 0) {
              await tx.menuItemTranslation.updateMany({
                where: {
                  menuItemId: {
                    in: linkedMenuItems.map((item) => item.id),
                  },
                  languageId: t.languageId,
                },
                data: {
                  slug: t.slug,
                },
              });
            }
          }

          // Replace blocks
          await tx.pageContentBlock.deleteMany({
            where: { translationId: translation.id },
          });

          if (t.blocks?.length) {
            await tx.pageContentBlock.createMany({
              data: t.blocks.map((b) => ({
                translationId: translation.id,
                type: b.type,
                data: b.data,
                sortOrder: b.sortOrder,
              })),
            });
          }
        }
      }

      return (await this.findByIdInTransaction(tx, id))!;
    });
  }

  // ==========================================
  // DELETE / TRASH OPERATIONS
  // ==========================================

  async softDelete(id: number): Promise<void> {
    await this.prisma.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<void> {
    await this.prisma.page.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async hardDelete(id: number): Promise<void> {
    await this.prisma.page.delete({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.hardDelete(id);
  }

  // ==========================================
  // BULK OPERATIONS
  // ==========================================

  async softDeleteMany(ids: number[]) {
    await this.prisma.page.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  }

  async restoreMany(ids: number[]) {
    await this.prisma.page.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
  }

  async hardDeleteMany(ids: number[]) {
    await this.prisma.page.deleteMany({
      where: { id: { in: ids } },
    });
  }

  async publishMany(ids: number[]) {
    await this.prisma.page.updateMany({
      where: { id: { in: ids } },
      data: { published: true },
    });
  }

  async unpublishMany(ids: number[]) {
    await this.prisma.page.updateMany({
      where: { id: { in: ids } },
      data: { published: false },
    });
  }

  // ==========================================
  // VERSION RESTORE
  // ==========================================

  async getVersionById(versionId: number) {
    return this.prisma.pageVersion.findUnique({
      where: { id: versionId },
    });
  }

  async restoreVersion(versionId: number): Promise<void> {
    const version = await this.prisma.pageVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) throw new Error('Version not found');

    const snapshot = jsonToObject(version.snapshot);

    await this.update(version.pageId, {
      translations: [snapshot.translation],
    });
  }

  // ==========================================
  // VERSION HISTORY
  // ==========================================

  async createVersion(pageId: number, languageId: number, snapshot: any) {
    await this.prisma.pageVersion.create({
      data: { pageId, languageId, snapshot },
    });
  }

  async getVersions(pageId: number, query: PagePaginatedQueryDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const skip = (page - 1) * limit;

    // 1️⃣ Total count (needed for pagination metadata)
    const total = await this.prisma.pageVersion.count({
      where: {
        pageId,
      },
    });

    // 2️⃣ Fetch paginated versions
    const versions = await this.prisma.pageVersion.findMany({
      where: {
        pageId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        language: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // 3️⃣ Map results
    const data = versions.map((v) => ({
      id: v.id,
      pageId: v.pageId,
      languageId: v.languageId,
      snapshot: jsonToObject(v.snapshot),
      createdAt: v.createdAt,
      language: v.language,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  async exists(id: number): Promise<boolean> {
    const count = await this.prisma.page.count({ where: { id } });
    return count > 0;
  }

  async isSlugUnique(slug: string, languageId: number, excludePageId?: number) {
    const found = await this.prisma.pageTranslation.findFirst({
      where: {
        slug,
        languageId,
        ...(excludePageId && { pageId: { not: excludePageId } }),
      },
    });

    return !found;
  }

  async reorder(updates: Array<{ id: number; sortOrder: number }>) {
    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.page.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        }),
      ),
    );
  }

  // ==========================================
  // PRIVATE TRANSACTION HELPERS
  // ==========================================

  private async findByIdInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<PageAggregate | null> {
    const page = await tx.page.findUnique({
      where: { id },
      include: {
        translations: {
          where: { deletedAt: null },
          include: {
            blocks: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        slugAliases: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            language: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!page) return null;

    return this.mapToAggregate(page);
  }
}
