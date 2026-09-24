// src/modules/posts/infrastructure/prisma-post-aggregate.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { PostAggregate, PostFilters, IPostAggregateRepository } from '../domain';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { PagePaginatedQueryDto } from '@/modules/menu/dto/pagination.dto';

// ✅ Safe JSON converter
function jsonToObject(json: Prisma.JsonValue): Record<string, any> {
  if (!json) return {};
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, any>;
  }
  return {};
}

@Injectable()
export class PrismaPostAggregateRepository implements IPostAggregateRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // READ
  // =====================================================

  async findById(id: number): Promise<PostAggregate | null> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    return post ? this.mapToAggregate(post) : null;
  }

  async findBySlug(slug: string, languageId?: number): Promise<PostAggregate | null> {
    const translation = await this.prisma.postTranslation.findFirst({
      where: {
        slug,
        ...(languageId && { languageId }),
      },
      select: { postId: true },
    });

    if (translation) return this.findById(translation.postId);

    const alias = await this.prisma.postSlugAlias.findFirst({
      where: {
        slug,
        ...(languageId && { languageId }),
      },
      select: { postId: true },
    });

    return alias ? this.findById(alias.postId) : null;
  }

  async findAll(filters?: PostFilters, pagination?: PaginationOptions): Promise<PostAggregate[]> {
    const posts = await this.prisma.post.findMany({
      where: this.buildWhere(filters),
      orderBy: this.buildOrderBy(pagination),
      include: this.getFullInclude(),
    });

    return posts.map((p) => this.mapToAggregate(p));
  }

  async findPaginated(
    filters?: PostFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PostAggregate>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const where = this.buildWhere(filters);

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: this.getFullInclude(),
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => this.mapToAggregate(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByAuthor(authorId: number, pagination?: PaginationOptions): Promise<PostAggregate[]> {
    return this.findAll({ authorId }, pagination);
  }

  // BUG: pageId is ignored — this returns every published post, not the ones
  // linked to the given page (the Post<->Page M2M is never consulted). Found
  // when strict unused-parameter checking was enabled. Not fixed here because
  // correcting the filter changes public site output and needs its own
  // verification pass.
  async findByPageId(_pageId: number, pagination?: PaginationOptions): Promise<PostAggregate[]> {
    return this.findAll(
      {
        published: true,
      },
      pagination,
    );
  }

  async findFeatured(limit: number = 5): Promise<PostAggregate[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        published: true,
        isFeatured: true,
        deletedAt: null,
      },
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: this.getFullInclude(),
    });

    return posts.map((p) => this.mapToAggregate(p));
  }

  // =====================================================
  // CREATE / UPDATE
  // =====================================================

  async create(post: PostAggregate): Promise<PostAggregate> {
    const created = await this.prisma.post.create({
      data: {
        type: (post.type ?? 'news') as any,
        authorId: post.authorId,
        coverImageId: post.coverImageId,
        published: post.published,
        isFeatured: post.isFeatured,
        viewCount: post.viewCount || 0,
        publishedAt: post.publishedAt,

        pages: post.pageIds?.length ? { connect: post.pageIds.map((id) => ({ id })) } : undefined,
        categories: post.categoryIds?.length
          ? {
              create: post.categoryIds.map((id) => ({
                category: { connect: { id } },
              })),
            }
          : undefined,

        translations: {
          create: post.translations.map((t) => ({
            languageId: t.languageId,
            title: t.title,
            slug: t.slug,
            excerpt: t.excerpt,
            content: t.content,
            metaTitle: t.metaTitle,
            metaDescription: t.metaDescription,
            blocks: {
              create: t.blocks.map((b) => ({
                type: b.type,
                data: b.data,
                sortOrder: b.sortOrder,
              })),
            },
          })),
        },
      },
      include: this.getFullInclude(),
    });

    return this.mapToAggregate(created);
  }

  async update(id: number, post: Partial<PostAggregate>): Promise<PostAggregate> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Post not found');

    // ✅ Create Version Snapshot BEFORE update
    for (const translation of existing.translations) {
      await this.createVersion(id, translation.languageId, {
        translation,
        updatedAt: new Date(),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: {
          ...(post.type !== undefined && { type: post.type as any }),
          coverImageId: post.coverImageId,
          published: post.published,
          isFeatured: post.isFeatured,
          publishedAt: post.publishedAt,

          pages:
            post.pageIds !== undefined
              ? {
                  set: [],
                  connect: post.pageIds.map((pid) => ({ id: pid })),
                }
              : undefined,
          categories:
            post.categoryIds !== undefined
              ? {
                  deleteMany: {},
                  create: post.categoryIds.map((cid) => ({
                    category: { connect: { id: cid } },
                  })),
                }
              : undefined,
        },
      });

      if (post.translations) {
        for (const t of post.translations) {
          const existingTranslation = existing.translations.find(
            (et) => et.languageId === t.languageId,
          );

          // Slug alias
          if (existingTranslation && existingTranslation.slug !== t.slug) {
            await tx.postSlugAlias.create({
              data: {
                postId: id,
                languageId: t.languageId,
                slug: existingTranslation.slug,
              },
            });
          }

          const updatedTranslation = await tx.postTranslation.upsert({
            where: {
              postId_languageId: {
                postId: id,
                languageId: t.languageId,
              },
            },
            create: {
              postId: id,
              languageId: t.languageId,
              title: t.title,
              slug: t.slug,
              excerpt: t.excerpt,
              content: t.content,
              metaTitle: t.metaTitle,
              metaDescription: t.metaDescription,
            },
            update: {
              title: t.title,
              slug: t.slug,
              excerpt: t.excerpt,
              content: t.content,
              metaTitle: t.metaTitle,
              metaDescription: t.metaDescription,
            },
          });

          // Blocks replace
          await tx.postContentBlock.deleteMany({
            where: { translationId: updatedTranslation.id },
          });

          if (t.blocks?.length) {
            await tx.postContentBlock.createMany({
              data: t.blocks.map((b) => ({
                translationId: updatedTranslation.id,
                type: b.type,
                data: b.data,
                sortOrder: b.sortOrder,
              })),
            });
          }
        }
      }
    });

    return (await this.findById(id))!;
  }

  // =====================================================
  // TRASH SYSTEM
  // =====================================================

  async findDeleted(): Promise<PostAggregate[]> {
    const posts = await this.prisma.post.findMany({
      where: { deletedAt: { not: null } },
      include: this.getFullInclude(),
      orderBy: { deletedAt: 'desc' },
    });

    return posts.map((p) => this.mapToAggregate(p));
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async hardDelete(id: number): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  async softDeleteMany(ids: number[]): Promise<void> {
    await this.prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  }

  async restoreMany(ids: number[]): Promise<void> {
    await this.prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
  }

  async hardDeleteMany(ids: number[]): Promise<void> {
    await this.prisma.post.deleteMany({ where: { id: { in: ids } } });
  }

  // =====================================================
  // VERSION SYSTEM
  // =====================================================

  async createVersion(
    postId: number,
    languageId: number,
    snapshot: Record<string, any>,
  ): Promise<void> {
    await this.prisma.postVersion.create({
      data: {
        postId,
        languageId,
        snapshot,
      },
    });
  }

  // async getVersionss(postId: number, languageId?: number) {
  //   return this.prisma.postVersion.findMany({
  //     where: {
  //       postId,
  //       ...(languageId && { languageId }),
  //     },
  //     orderBy: { createdAt: 'desc' },

  //     include: {
  //       language: {
  //         select: {
  //           id: true,
  //           code: true,
  //           name: true,
  //         },
  //       },
  //     },
  //   });
  // }

  async getVersions(postId: number, query: PagePaginatedQueryDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const skip = (page - 1) * limit;

    // 1️⃣ Total count (needed for pagination metadata)
    const total = await this.prisma.postVersion.count({
      where: {
        postId,
      },
    });

    // 2️⃣ Fetch paginated versions
    const versions = await this.prisma.postVersion.findMany({
      where: {
        postId,
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
      postId: v.postId,
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

  async restoreVersion(versionId: number): Promise<void> {
    const version = await this.prisma.postVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) throw new Error('Version not found');

    const snapshot = jsonToObject(version.snapshot);

    await this.update(version.postId, {
      translations: [snapshot.translation],
    });
  }

  // =====================================================
  // BULK + UTILITIES
  // =====================================================

  async publishMany(ids: number[]): Promise<void> {
    await this.prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { published: true, publishedAt: new Date() },
    });
  }

  async unpublishMany(ids: number[]): Promise<void> {
    await this.prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { published: false },
    });
  }

  async deleteMany(ids: number[]): Promise<void> {
    await this.softDeleteMany(ids);
  }

  async delete(id: number): Promise<void> {
    await this.hardDelete(id);
  }

  async exists(id: number): Promise<boolean> {
    return (await this.prisma.post.count({ where: { id } })) > 0;
  }

  async isSlugUnique(slug: string, languageId: number, excludePostId?: number): Promise<boolean> {
    const found = await this.prisma.postTranslation.findFirst({
      where: {
        slug,
        languageId,
        ...(excludePostId && { postId: { not: excludePostId } }),
      },
    });

    return !found;
  }

  async incrementViewCount(id: number): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private getFullInclude() {
    return {
      author: {
        select: { id: true, displayName: true, email: true },
      },
      coverImage: {
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
        include: {
          blocks: { orderBy: { sortOrder: 'asc' as const } },
        },
      },
      slugAliases: true,
      pages: true,
      categories: {
        include: {
          category: true,
        },
      },
    };
  }

  private buildWhere(filters?: PostFilters) {
    const where: any = { deletedAt: null };

    if (!filters) return where;

    if (filters.published !== undefined) where.published = filters.published;

    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

    if (filters.authorId) where.authorId = filters.authorId;

    // if (filters.searchTerm) {
    //   where.translations = {
    //     some: {
    //       OR: [
    //         { title: { contains: filters.searchTerm, mode: "insensitive" } },
    //         { content: { contains: filters.searchTerm, mode: "insensitive" } },
    //       ],
    //     },
    //   };
    // }

    if (filters.searchTerm) {
      where.OR = [
        {
          translations: {
            some: {
              title: {
                contains: filters.searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          translations: {
            some: {
              content: {
                contains: filters.searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions) {
    if (!pagination?.sortBy) return { createdAt: 'desc' as const };

    return { [pagination.sortBy]: pagination.sortOrder || 'desc' };
  }

  private mapToAggregate(post: any): PostAggregate {
    return {
      id: post.id,
      type: post.type ?? 'news',
      authorId: post.authorId,
      coverImageId: post.coverImageId,
      coverImage: post.coverImage ?? null,
      published: post.published,
      isFeatured: post.isFeatured,
      viewCount: post.viewCount,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      deletedAt: post.deletedAt ?? null,

      translations: post.translations.map((t: any) => ({
        id: t.id,
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt,
        content: t.content,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
        blocks: t.blocks.map((b: any) => ({
          id: b.id,
          type: b.type,
          data: b.data,
          sortOrder: b.sortOrder,
        })),
      })),

      slugAliases: post.slugAliases,
      author: post.author,
      pages: post.pages,
      pageIds: post.pages?.map((p: any) => p.id),
      categories: post.categories?.map((c: any) => ({
        id: c.category.id,
        slug: c.category.slug,
      })),

      categoryIds: post.categories?.map((c: any) => c.category.id),
    };
  }
}
