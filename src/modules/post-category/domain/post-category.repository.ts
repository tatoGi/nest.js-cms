import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { PostCategoryAggregate } from './post-category.aggregate';

export type PostCategoryFilters = {
  search?: string;
  isActive?: boolean;
  parentId?: number | null;
  languageCode?: string;
};

export abstract class PostCategoryRepository {
  abstract findById(id: number): Promise<PostCategoryAggregate>;
  abstract findBySlug(slug: string): Promise<PostCategoryAggregate>;
  abstract findAll(filters?: PostCategoryFilters): Promise<PostCategoryAggregate[]>;
  abstract findPaginated(
    filters?: PostCategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PostCategoryAggregate>>;
  abstract slugExists(slug: string, excludeId?: number): Promise<boolean>;
}
