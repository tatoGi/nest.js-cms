import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { PostAggregate, PostFilters, IPostAggregateRepository } from '../domain';

import { PostQueryDto, PostListItemDto, PostPaginatedQueryDto } from '../dto';

import { PostMapper } from '../api/mappers/post.mapper';
import { PaginatedResponseDto, PaginationOptions } from '@/common/pagination';
import { PagePaginatedQueryDto } from '@/modules/menu/dto/pagination.dto';
import { PostVersion } from '.prisma/client/default';
import {
  PostNotFoundException,
  PostDuplicateException,
  InvalidBulkActionException,
} from '@/common/exceptions';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/application/notifications.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { PostsPermissions } from './posts.permissions';

@Injectable()
export class PostsService {
  constructor(
    @Inject('IPostAggregateRepository')
    private readonly postAggregateRepository: IPostAggregateRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================
  // AGGREGATE OPERATIONS (ADMIN)
  // ==========================================

  /**
   * Create a new post aggregate.
   * Validates slug uniqueness per language before persisting.
   * @throws PostDuplicateException if any translation slug already exists
   */
  async createAggregate(aggregate: PostAggregate, meta?: ActionMeta): Promise<PostAggregate> {
    for (const translation of aggregate.translations) {
      const isUnique = await this.postAggregateRepository.isSlugUnique(
        translation.slug,
        translation.languageId,
      );

      if (!isUnique) {
        throw new PostDuplicateException(translation.slug);
      }
    }

    const created = await this.postAggregateRepository.create(aggregate);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PostsPermissions.CREATE_POSTS,
      targetType: 'post',
      targetId: created.id ?? undefined,
      after: {
        translations: created.translations.map((t) => ({
          languageId: t.languageId,
          title: t.title,
          slug: t.slug,
        })),
      },
      ip: meta?.ip,
    });
    return created;
  }

  /**
   * Find a post aggregate by ID (admin — includes unpublished).
   * @throws PostNotFoundException if not found
   */
  async findAggregateById(id: number): Promise<PostAggregate> {
    const post = await this.postAggregateRepository.findById(id);

    if (!post) {
      throw new PostNotFoundException(id);
    }

    return post;
  }

  /**
   * Find a post aggregate by slug and optional language (admin — includes unpublished).
   * @throws PostNotFoundException if not found
   */
  async findAggregateBySlug(slug: string, languageId?: number): Promise<PostAggregate> {
    const post = await this.postAggregateRepository.findBySlug(slug, languageId);

    if (!post) {
      throw new PostNotFoundException(slug);
    }

    return post;
  }

  /**
   * Update a post aggregate.
   * Rejects updates on trashed (soft-deleted) posts — restore first.
   * For each translation that changed (title, slug, content, or blocks), a version snapshot
   * of the previous state is created before the update is applied.
   * Slug uniqueness is validated per language (excluding the current post).
   * @throws PostNotFoundException if the post does not exist or is trashed
   * @throws PostDuplicateException if an updated slug is already taken
   */
  async updateAggregate(
    id: number,
    aggregate: Partial<PostAggregate>,
    meta?: ActionMeta,
  ): Promise<PostAggregate> {
    const existing = await this.findAggregateById(id);

    if (existing.deletedAt) {
      throw new PostNotFoundException(id);
    }

    // ==========================================
    // ✅ VERSION SNAPSHOT (ONLY UPDATED LANGUAGES)
    // ==========================================
    if (aggregate.translations?.length) {
      for (const updatedTranslation of aggregate.translations) {
        const oldTranslation = existing.translations.find(
          (t) => t.languageId === updatedTranslation.languageId,
        );

        if (!oldTranslation) continue;

        // ✅ Only create version if something actually changed
        const changed =
          oldTranslation.title !== updatedTranslation.title ||
          oldTranslation.slug !== updatedTranslation.slug ||
          oldTranslation.content !== updatedTranslation.content ||
          JSON.stringify(oldTranslation.blocks) !== JSON.stringify(updatedTranslation.blocks);

        if (changed) {
          await this.postAggregateRepository.createVersion(id, oldTranslation.languageId, {
            translation: oldTranslation,
            updatedAt: new Date(),
          });
        }
      }
    }

    // ==========================================
    // ✅ SLUG UNIQUENESS CHECK
    // ==========================================
    if (aggregate.translations?.length) {
      for (const translation of aggregate.translations) {
        const old = existing.translations.find((t) => t.languageId === translation.languageId);

        if (!old || old.slug !== translation.slug) {
          const isUnique = await this.postAggregateRepository.isSlugUnique(
            translation.slug,
            translation.languageId,
            id,
          );

          if (!isUnique) {
            throw new PostDuplicateException(translation.slug);
          }
        }
      }
    }

    const updated = await this.postAggregateRepository.update(id, aggregate);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PostsPermissions.UPDATE_POSTS,
      targetType: 'post',
      targetId: id,
      after: {
        translations: (aggregate.translations ?? []).map((t) => ({
          languageId: t.languageId,
          title: t.title,
          slug: t.slug,
        })),
      },
      ip: meta?.ip,
    });
    return updated;
  }

  // ==========================================
  // TRASH OPERATIONS
  // ==========================================

  /**
   * Soft-delete a post (sets `deletedAt`). Creates a notification.
   * @throws PostNotFoundException if the post does not exist
   */
  async softDelete(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.postAggregateRepository.softDelete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PostsPermissions.DELETE_POSTS,
      targetType: 'post',
      targetId: id,
      ip: meta?.ip,
    });
    await this.notificationsService.create({
      type: 'post.trashed',
      title: 'Post moved to trash',
      message: `Post #${id} was moved to trash.`,
      link: `/posts/trash`,
      actorId: meta?.actorId,
    });
  }

  /**
   * Restore a soft-deleted post (clears `deletedAt`).
   * @throws PostNotFoundException if the post does not exist
   */
  async restore(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.postAggregateRepository.restore(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PostsPermissions.DELETE_POSTS,
      targetType: 'post',
      targetId: id,
      ip: meta?.ip,
    });
  }

  /**
   * Permanently delete a post and all its translations, blocks, and versions.
   * Creates a notification.
   * @throws PostNotFoundException if the post does not exist
   */
  async hardDelete(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.postAggregateRepository.hardDelete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PostsPermissions.DELETE_POSTS,
      targetType: 'post',
      targetId: id,
      ip: meta?.ip,
    });
    await this.notificationsService.create({
      type: 'post.deleted',
      title: 'Post permanently deleted',
      message: `Post #${id} was permanently deleted.`,
      actorId: meta?.actorId,
    });
  }

  /**
   * Return all soft-deleted posts as list items for the trash view.
   * @param languageId - translation language to use for titles/slugs (default: 1)
   */
  async getDeletedPosts(languageId: number = 1): Promise<PostListItemDto[]> {
    const deleted = await this.postAggregateRepository.findDeleted();
    return PostMapper.toListItems(deleted, languageId);
  }

  // ==========================================
  // VERSION OPERATIONS
  // ==========================================

  /**
   * Return paginated version history for a post.
   * @throws PostNotFoundException if the post does not exist
   */
  async getVersions(pageId: number, query: PagePaginatedQueryDto) {
    await this.findAggregateById(pageId);

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.postAggregateRepository.getVersions(pageId, paginationOptions);

    return new PaginatedResponseDto<PostVersion>(
      result.data,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  /**
   * Restore a post translation to the state captured in a specific version snapshot.
   * @param versionId - the version record to restore from
   */
  async restoreVersion(versionId: number): Promise<void> {
    await this.postAggregateRepository.restoreVersion(versionId);
  }

  // ==========================================
  // LIST OPERATIONS (ADMIN)
  // ==========================================

  /**
   * Return up to 500 posts (published and unpublished) as list items.
   * Capped to prevent unbounded table scans on large datasets.
   * @param query - optional filters (published, isFeatured, authorId, search)
   * @param languageId - translation language to use (default: 1)
   */
  async findAllList(query?: PostQueryDto, languageId: number = 1): Promise<PostListItemDto[]> {
    const filters = this.mapQueryToFilters(query);

    const result = await this.postAggregateRepository.findPaginated(filters, {
      page: 1,
      limit: 500,
    });

    return PostMapper.toListItems(result.data, languageId);
  }

  /**
   * Return a paginated list of posts (published and unpublished).
   * @param query - filters + pagination params
   * @param languageId - translation language to use (default: 1)
   */
  async findAllListPaginated(
    query: PostPaginatedQueryDto,
    languageId: number = 1,
  ): Promise<PaginatedResponseDto<PostListItemDto>> {
    const filters = this.mapQueryToFilters(query);

    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.postAggregateRepository.findPaginated(filters, paginationOptions);

    return {
      data: PostMapper.toListItems(result.data, languageId),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  // ==========================================
  // PUBLIC OPERATIONS (RETURN DTOs)
  // ==========================================

  /**
   * Return up to 500 published posts as list items (public site).
   * Capped to prevent unbounded table scans on large datasets.
   * @param languageId - translation language to use (default: 1)
   */
  async findPublishedPosts(languageId: number = 1): Promise<PostListItemDto[]> {
    const result = await this.postAggregateRepository.findPaginated(
      { published: true },
      { page: 1, limit: 500, sortBy: 'publishedAt', sortOrder: 'desc' },
    );

    return PostMapper.toListItems(result.data, languageId);
  }

  /**
   * Return a paginated list of published posts, sorted by `publishedAt` desc by default.
   * @param query - pagination params
   * @param languageId - translation language to use (default: 1)
   */
  async findPublishedPostsPaginated(
    query: PostPaginatedQueryDto,
    languageId: number = 1,
  ): Promise<PaginatedResponseDto<PostListItemDto>> {
    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy || 'publishedAt',
      sortOrder: query.sortOrder || 'desc',
    };

    const result = await this.postAggregateRepository.findPaginated(
      { published: true },
      paginationOptions,
    );

    return {
      data: PostMapper.toListItems(result.data, languageId),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Return the top N featured published posts.
   * @param limit - max number of posts to return (default: 5)
   * @param languageId - translation language to use (default: 1)
   */
  async findFeaturedPosts(limit: number = 5, languageId: number = 1): Promise<PostListItemDto[]> {
    const posts = await this.postAggregateRepository.findFeatured(limit);

    return PostMapper.toListItems(posts, languageId);
  }

  /**
   * Find a published post by its translation slug (public site).
   * @returns the aggregate or null if not found or not published
   */
  async findPublishedBySlug(slug: string, languageId: number = 1): Promise<PostAggregate | null> {
    const post = await this.postAggregateRepository.findBySlug(slug, languageId);

    if (!post || !post.published) return null;

    return post;
  }

  /**
   * Find a published post by ID (public site).
   * @returns the aggregate or null if not found or not published
   */
  async findPublishedById(id: number, _languageId: number = 1): Promise<PostAggregate | null> {
    const post = await this.postAggregateRepository.findById(id);

    if (!post || !post.published) return null;

    return post;
  }

  /**
   * Return published posts by a specific author.
   * Unpublished posts from the author are filtered out.
   */
  async findByAuthor(
    authorId: number,
    languageId: number = 1,
    pagination?: PaginationOptions,
  ): Promise<PostListItemDto[]> {
    const posts = await this.postAggregateRepository.findByAuthor(authorId, pagination);

    const published = posts.filter((p) => p.published);

    return PostMapper.toListItems(published, languageId);
  }

  /**
   * Increment the view counter for a post. Fire-and-forget — no return value.
   */
  async incrementViewCount(id: number): Promise<void> {
    await this.postAggregateRepository.incrementViewCount(id);
  }

  // ==========================================
  // BULK OPERATIONS
  // ==========================================

  /**
   * Apply an action to multiple posts at once.
   * - `publish` — set `published = true` on all given IDs; creates a notification
   * - `unpublish` — set `published = false`
   * - `delete` — soft-delete (sets `deletedAt`)
   * @throws InvalidBulkActionException for unknown action values
   */
  async bulkAction(
    ids: number[],
    action: 'publish' | 'unpublish' | 'delete' | 'restore' | 'hardDelete',
    meta?: ActionMeta,
  ): Promise<void> {
    switch (action) {
      case 'publish':
        await this.postAggregateRepository.publishMany(ids);
        break;

      case 'unpublish':
        await this.postAggregateRepository.unpublishMany(ids);
        break;

      case 'delete':
        await this.postAggregateRepository.softDeleteMany(ids);
        break;

      case 'restore':
        await this.postAggregateRepository.restoreMany(ids);
        break;

      case 'hardDelete':
        await this.postAggregateRepository.hardDeleteMany(ids);
        break;

      default:
        throw new InvalidBulkActionException(action);
    }

    await this.auditService.log({
      actorId: meta?.actorId,
      action:
        action === 'publish' || action === 'unpublish'
          ? PostsPermissions.PUBLISH_POSTS
          : PostsPermissions.DELETE_POSTS,
      targetType: 'post',
      after: { ids, action },
      ip: meta?.ip,
    });

    if (action === 'publish') {
      await this.notificationsService.create({
        type: 'post.published',
        title: 'Posts published',
        message: `${ids.length} post(s) were published.`,
        link: `/posts`,
        actorId: meta?.actorId,
      });
    }
  }

  // ==========================================
  // SLUG CHECK
  // ==========================================

  /**
   * Check whether a slug is unique for a given language.
   * @param excludePostId - exclude this post ID from the check (for updates)
   */
  async isSlugUnique(slug: string, languageId: number, excludePostId?: number): Promise<boolean> {
    return this.postAggregateRepository.isSlugUnique(slug, languageId, excludePostId);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private mapQueryToFilters(query?: PostQueryDto): PostFilters {
    if (!query) return {};

    return {
      published: query.published,
      isFeatured: query.isFeatured,
      authorId: query.authorId,
      searchTerm: query.search,
    };
  }
}
