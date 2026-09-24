export class PostCategoryTranslationResponseDto {
  id: number;
  languageId: number;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PostCategoryAggregateResponseDto {
  id: number;
  slug: string;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  translations: PostCategoryTranslationResponseDto[];
  children?: PostCategoryAggregateResponseDto[];
  postCount?: number;
}
