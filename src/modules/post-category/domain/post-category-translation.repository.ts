import { PostCategoryTranslation } from '@prisma/client';

export abstract class PostCategoryTranslationRepository {
  abstract findByCategoryAndLanguage(
    categoryId: number,
    languageId: number,
  ): Promise<PostCategoryTranslation | null>;

  abstract upsert(
    categoryId: number,
    languageId: number,
    data: { slug: string; name: string; description?: string | null },
  ): Promise<PostCategoryTranslation>;

  abstract deleteByCategory(categoryId: number): Promise<void>;

  abstract deleteByCategoryAndLanguage(categoryId: number, languageId: number): Promise<void>;
}
