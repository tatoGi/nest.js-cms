import { Injectable, BadRequestException } from '@nestjs/common';
import { PostCategoryRepository, PostCategoryFilters } from '../domain/post-category.repository';
import { PostCategoryAggregateRepository } from '../domain/post-category.aggregate.repository';
import { PostCategoryMapper } from '../api/mappers/post-category.mapper';
import {
  CreatePostCategoryAggregateDto,
  UpdatePostCategoryAggregateDto,
  PostCategoryListItemDto,
  PostCategoryPaginatedQueryDto,
} from '../dto';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { PostCategoryNotFoundException, PostCategoryDuplicateException } from '@/common/exceptions';

@Injectable()
export class PostCategoryService {
  constructor(
    private readonly categoryRepo: PostCategoryRepository,
    private readonly aggregateRepo: PostCategoryAggregateRepository,
  ) {}

  async findAllListPaginated(
    query: PostCategoryPaginatedQueryDto,
    languageId: number = 1,
  ): Promise<PaginatedResult<PostCategoryListItemDto>> {
    const filters = this.mapQueryToFilters(query);

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    const result = await this.categoryRepo.findPaginated(filters, paginationOptions);

    return new PaginatedResponseDto<PostCategoryListItemDto>(
      PostCategoryMapper.toListItems(result.data, languageId),
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async findById(id: number) {
    const category = await this.categoryRepo.findById(id);

    if (!category) {
      throw new PostCategoryNotFoundException(id);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.categoryRepo.findBySlug(slug);

    if (!category) {
      throw new PostCategoryNotFoundException(slug);
    }

    return category;
  }

  async create(dto: CreatePostCategoryAggregateDto) {
    const slugExists = await this.categoryRepo.slugExists(dto.slug);
    if (slugExists) {
      throw new PostCategoryDuplicateException(dto.slug);
    }

    if (dto.parentId) {
      await this.validateParent(dto.parentId);
    }

    return this.aggregateRepo.createAggregate(dto);
  }

  async update(id: number, dto: UpdatePostCategoryAggregateDto) {
    const existing = await this.categoryRepo.findById(id);
    if (!existing) {
      throw new PostCategoryNotFoundException(id);
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.categoryRepo.slugExists(dto.slug, id);
      if (slugExists) {
        throw new PostCategoryDuplicateException(dto.slug);
      }
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.validateParent(dto.parentId, id);
    }

    return this.aggregateRepo.updateAggregate(id, dto);
  }

  async delete(id: number) {
    const existing = await this.categoryRepo.findById(id);
    if (!existing) {
      throw new PostCategoryNotFoundException(id);
    }

    return this.aggregateRepo.deleteAggregate(id);
  }

  async findAllTree(languageCode?: string) {
    const filters: PostCategoryFilters = { isActive: true };
    if (languageCode) {
      filters.languageCode = languageCode;
    }

    const categories = await this.categoryRepo.findAll(filters);
    return this.buildTree(categories);
  }

  // ─── Private helpers ───────────────────────────────────────

  private mapQueryToFilters(query: PostCategoryPaginatedQueryDto): PostCategoryFilters {
    const filters: PostCategoryFilters = {};

    if (query.search) filters.search = query.search;
    if (query.isActive !== undefined) filters.isActive = query.isActive;
    if (query.parentId !== undefined) filters.parentId = query.parentId;
    if (query.languageCode) filters.languageCode = query.languageCode;

    return filters;
  }

  private buildTree(categories: any[], parentId: number | null = null): any[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        children: this.buildTree(categories, c.id),
      }));
  }

  private async validateParent(parentId: number, currentId?: number): Promise<void> {
    const parent = await this.categoryRepo.findById(parentId);
    if (!parent) {
      throw new PostCategoryNotFoundException(parentId);
    }

    if (currentId) {
      const isDescendant = await this.isDescendantOf(parentId, currentId);
      if (isDescendant) {
        throw new BadRequestException(
          'Cannot set a descendant category as parent (circular reference)',
        );
      }
    }
  }

  private async isDescendantOf(categoryId: number, potentialAncestorId: number): Promise<boolean> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category || !category.parentId) return false;
    if (category.parentId === potentialAncestorId) return true;
    return this.isDescendantOf(category.parentId, potentialAncestorId);
  }
}
