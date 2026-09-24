// src/modules/page-templates/domain/page-templates.repository.ts

import { PageTemplate } from '@prisma/client';
import { CreatePageTemplateDto, UpdatePageTemplateDto, PageTemplateQueryDto } from '../dto';
import { PaginatedResult } from '@/modules/menu/domain/menu.repository';

export interface IPageTemplatesRepository {
  /**
   * Create a new page template
   */
  create(data: CreatePageTemplateDto): Promise<PageTemplate>;
  // create(data: CreatePageTemplateDto, userId: number): Promise<PageTemplate>;

  /**
   * Find all page templates with optional filters
   */
  findAll(query?: PageTemplateQueryDto): Promise<PageTemplate[]>;

  findPaginated(
    query?: PageTemplateQueryDto,
    paginationOptions?: any,
  ): Promise<PaginatedResult<PageTemplate>>;

  /**
   * Find page template by ID
   */
  findById(id: number): Promise<PageTemplate | null>;

  /**
   * Find page template by slug
   */
  findBySlug(slug: string): Promise<PageTemplate | null>;

  /**
   * Update page template
   */
  update(
    id: number,
    data: UpdatePageTemplateDto,
    // userId: number,
  ): Promise<PageTemplate>;

  /**
   * Delete page template
   */
  delete(id: number): Promise<PageTemplate>;

  /**
   * Check if slug exists (for validation)
   */
  slugExists(slug: string, excludeId?: number): Promise<boolean>;

  /**
   * Get templates created by specific user
   */
  findByCreator(userId: number): Promise<PageTemplate[]>;

  /**
   * Get recently updated templates
   */
  findRecentlyUpdated(limit?: number): Promise<PageTemplate[]>;
}
