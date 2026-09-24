// src/modules/posts/domain/post-aggregate.repository.ts

import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { PostAggregate } from './post.aggregate';
import { PostFilters } from './post.repository';

export interface IPostAggregateRepository {
  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Find full post aggregate by ID
   */
  findById(id: number): Promise<PostAggregate | null>;

  /**
   * Find post aggregate by slug (optionally language-specific)
   */
  findBySlug(slug: string, languageId?: number): Promise<PostAggregate | null>;

  /**
   * Find all posts with filters
   */
  findAll(filters?: PostFilters, pagination?: PaginationOptions): Promise<PostAggregate[]>;

  /**
   * Find paginated posts
   */
  findPaginated(
    filters?: PostFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PostAggregate>>;

  /**
   * Find posts by author
   */
  findByAuthor(authorId: number, pagination?: PaginationOptions): Promise<PostAggregate[]>;

  /**
   * Find posts linked to a page
   */
  findByPageId(pageId: number, pagination?: PaginationOptions): Promise<PostAggregate[]>;

  /**
   * Find featured posts
   */
  findFeatured(limit?: number): Promise<PostAggregate[]>;

  /**
   * Find deleted posts (Trash)
   */
  findDeleted(): Promise<PostAggregate[]>;

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  /**
   * Create full post aggregate
   */
  create(post: PostAggregate): Promise<PostAggregate>;

  /**
   * Update post aggregate
   */
  update(id: number, post: Partial<PostAggregate>): Promise<PostAggregate>;

  // ==========================================
  // DELETE OPERATIONS
  // ==========================================

  /**
   * Hard delete post permanently
   */
  delete(id: number): Promise<void>;

  /**
   * Soft delete → Move to Trash
   */
  softDelete(id: number): Promise<void>;

  /**
   * Restore from Trash
   */
  restore(id: number): Promise<void>;

  /**
   * Hard delete forever (alias)
   */
  hardDelete(id: number): Promise<void>;

  /**
   * Bulk soft delete → Trash many posts
   */
  softDeleteMany(ids: number[]): Promise<void>;

  /**
   * Bulk hard delete
   */
  deleteMany(ids: number[]): Promise<void>;

  /**
   * Bulk restore → un-trash many posts
   */
  restoreMany(ids: number[]): Promise<void>;

  /**
   * Bulk hard delete (explicit — same as deleteMany, used by bulkAction's
   * 'hardDelete' case for parity with softDeleteMany/restoreMany naming)
   */
  hardDeleteMany(ids: number[]): Promise<void>;

  // ==========================================
  // VALIDATION
  // ==========================================

  /**
   * Check if post exists
   */
  exists(id: number): Promise<boolean>;

  /**
   * Check if slug is unique for language
   */
  isSlugUnique(slug: string, languageId: number, excludePostId?: number): Promise<boolean>;

  // ==========================================
  // BULK PUBLISH OPERATIONS
  // ==========================================

  /**
   * Publish multiple posts
   */
  publishMany(ids: number[]): Promise<void>;

  /**
   * Unpublish multiple posts
   */
  unpublishMany(ids: number[]): Promise<void>;

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Increment view count
   */
  incrementViewCount(id: number): Promise<void>;

  // ==========================================
  // VERSIONING OPERATIONS
  // ==========================================

  /**
   * Create version snapshot before update
   */
  createVersion(postId: number, languageId: number, snapshot: Record<string, any>): Promise<void>;

  /**
   * Get version history for post
   */
  getVersions(postId: number, pagination?: PaginationOptions): Promise<PaginatedResult<any>>;
  /**
   * Restore a post version snapshot
   */
  restoreVersion(versionId: number): Promise<void>;
}
