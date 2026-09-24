import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PostCategoryTranslation } from '@prisma/client';
import { PostCategoryTranslationRepository } from '../domain/post-category-translation.repository';

@Injectable()
export class PrismaPostCategoryTranslationRepository extends PostCategoryTranslationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByCategoryAndLanguage(
    categoryId: number,
    languageId: number,
  ): Promise<PostCategoryTranslation | null> {
    return this.prisma.postCategoryTranslation.findUnique({
      where: {
        categoryId_languageId: { categoryId, languageId },
      },
    });
  }

  async upsert(
    categoryId: number,
    languageId: number,
    data: { slug: string; name: string; description?: string | null },
  ): Promise<PostCategoryTranslation> {
    return this.prisma.postCategoryTranslation.upsert({
      where: {
        categoryId_languageId: { categoryId, languageId },
      },
      create: {
        categoryId,
        languageId,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
      },
      update: {
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
      },
    });
  }

  async deleteByCategory(categoryId: number): Promise<void> {
    await this.prisma.postCategoryTranslation.deleteMany({
      where: { categoryId },
    });
  }

  async deleteByCategoryAndLanguage(categoryId: number, languageId: number): Promise<void> {
    await this.prisma.postCategoryTranslation.deleteMany({
      where: { categoryId, languageId },
    });
  }
}
