import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PostCategoryRepository, PostCategoryFilters } from '../domain/post-category.repository';
import { PostCategoryAggregate } from '../domain/post-category.aggregate';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';

@Injectable()
export class PrismaPostCategoryRepository extends PostCategoryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: number): Promise<PostCategoryAggregate> {
    const result = await this.prisma.postCategory.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });
    if (!result) {
      throw new Error(`PostCategory with id ${id} not found`);
    }
    return this.mapToAggregate(result);
  }

  async findBySlug(slug: string): Promise<PostCategoryAggregate> {
    const result = await this.prisma.postCategory.findUnique({
      where: { slug },
      include: this.getFullInclude(),
    });
    if (!result) {
      throw new Error(`PostCategory with slug ${slug} not found`);
    }
    return this.mapToAggregate(result);
  }

  async findAll(filters?: PostCategoryFilters): Promise<PostCategoryAggregate[]> {
    const data = await this.prisma.postCategory.findMany({
      where: this.buildWhere(filters),
      include: this.getFullInclude(),
      orderBy: { sortOrder: 'asc' },
    });

    return data.map((p) => this.mapToAggregate(p));
  }

  async findPaginated(
    filters?: PostCategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PostCategoryAggregate>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const [data, total] = await Promise.all([
      this.prisma.postCategory.findMany({
        where: this.buildWhere(filters),
        include: this.getFullInclude(),
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.postCategory.count({ where: this.buildWhere(filters) }),
    ]);

    return {
      data: data.map((p) => this.mapToAggregate(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.postCategory.count({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  // ─── Private helpers ───────────────────────────────────────

  private getFullInclude() {
    return {
      translations: true,
      children: {
        include: { translations: true },
        orderBy: { sortOrder: 'asc' as const },
      },
      _count: { select: { posts: true } },
    };
  }

  private buildWhere(filters?: PostCategoryFilters): Prisma.PostCategoryWhereInput {
    if (!filters) return {};

    const where: Prisma.PostCategoryWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters.search) {
      where.OR = [
        { slug: { contains: filters.search, mode: 'insensitive' } },
        {
          translations: {
            some: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    if (filters.languageCode) {
      where.translations = {
        some: {
          language: { code: filters.languageCode },
        },
      };
    }

    return where;
  }

  private buildOrderBy(
    pagination?: PaginationOptions,
  ): Prisma.PostCategoryOrderByWithRelationInput {
    if (pagination?.sortBy) {
      return { [pagination.sortBy]: pagination.sortOrder ?? 'asc' };
    }
    return { sortOrder: 'asc' };
  }

  private mapToAggregate(raw: any): PostCategoryAggregate {
    return raw as unknown as PostCategoryAggregate;
  }
}
