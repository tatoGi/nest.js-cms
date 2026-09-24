import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PostCategoryAggregateRepository } from '../domain/post-category.aggregate.repository';
import { PostCategoryAggregate } from '../domain/post-category.aggregate';
import { CreatePostCategoryAggregateDto } from '../dto/create-post-category-aggregate.dto';

@Injectable()
export class PrismaPostCategoryAggregateRepository extends PostCategoryAggregateRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createAggregate(dto: CreatePostCategoryAggregateDto): Promise<PostCategoryAggregate> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.postCategory.create({
        data: {
          slug: dto.slug,
          parentId: dto.parentId ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          translations: {
            create: dto.translations.map((t) => ({
              languageId: t.languageId,
              slug: t.slug,
              name: t.name,
              description: t.description ?? null,
            })),
          },
        },
        include: this.getFullInclude(),
      });

      return this.mapToAggregate(result);
    });
  }

  async updateAggregate(
    id: number,
    dto: Partial<CreatePostCategoryAggregateDto>,
  ): Promise<PostCategoryAggregate> {
    return this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (dto.slug !== undefined) updateData.slug = dto.slug;
      if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await tx.postCategory.update({
        where: { id },
        data: updateData,
      });

      // ✅ HANDLE TRANSLATIONS PROPERLY
      if (dto.translations) {
        const incomingLanguageIds = dto.translations.map((t) => t.languageId);

        // 🔥 1️⃣ DELETE removed translations
        await tx.postCategoryTranslation.deleteMany({
          where: {
            categoryId: id,
            languageId: {
              notIn: incomingLanguageIds,
            },
          },
        });

        // 🔥 2️⃣ UPSERT remaining translations
        for (const t of dto.translations) {
          await tx.postCategoryTranslation.upsert({
            where: {
              categoryId_languageId: {
                categoryId: id,
                languageId: t.languageId,
              },
            },
            create: {
              categoryId: id,
              languageId: t.languageId,
              slug: t.slug,
              name: t.name,
              description: t.description ?? null,
            },
            update: {
              slug: t.slug,
              name: t.name,
              description: t.description ?? null,
            },
          });
        }
      }

      const updated = await tx.postCategory.findUniqueOrThrow({
        where: { id },
        include: this.getFullInclude(),
      });

      return this.mapToAggregate(updated);
    });
  }

  async deleteAggregate(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.postCategory.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });

      await tx.postCategory.delete({
        where: { id },
      });
    });
  }

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

  private mapToAggregate(raw: any): PostCategoryAggregate {
    return {
      id: raw.id,
      parentId: raw.parentId,
      slug: raw.slug,
      sortOrder: raw.sortOrder,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,

      translations: raw.translations.map((t: any) => ({
        id: t.id,
        categoryId: t.categoryId,
        languageId: t.languageId,
        slug: t.slug,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),

      children: raw.children?.map((child: any) => this.mapToAggregate(child)),
      _count: raw._count,
    };
  }
}
