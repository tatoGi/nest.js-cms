export class PostCategoryListItemDto {
  id: number;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  parentId: number | null;
  name: string;
  description: string | null;
  translationSlug: string;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}
