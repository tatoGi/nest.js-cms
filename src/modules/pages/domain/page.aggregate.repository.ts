// src/modules/pages/domain/page-aggregate.repository.ts

import { PageVersion } from '@prisma/client';
import { PageAggregate } from './page.aggregate';
import { PageFilters } from './page.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';

export interface IPageAggregateRepository {
  // ==========================================
  // FIND OPERATIONS
  // ==========================================

  /**
   * Find full page aggregate by ID (with all relations)
   */
  findById(id: number): Promise<PageAggregate | null>;

  /**
   * Find page aggregate by slug and language
   */
  findBySlug(slug: string, languageId: number): Promise<PageAggregate | null>;

  /**
   * Find all page aggregates with filters
   */
  findAll(filters?: PageFilters, pagination?: PaginationOptions): Promise<PageAggregate[]>;

  /**
   * Find paginated page aggregates
   */
  findPaginated(
    filters?: PageFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PageAggregate>>;

  /**
   * Find child pages
   */
  findChildren(parentId: number): Promise<PageAggregate[]>;

  /**
   * Find only soft-deleted pages (Trash)
   */
  findDeleted(): Promise<PageAggregate[]>;

  // ==========================================
  // CREATE / UPDATE OPERATIONS
  // ==========================================

  /**
   * Create full page aggregate (page + translations + blocks)
   */
  create(page: PageAggregate, createdById?: number): Promise<PageAggregate>;

  /**
   * Update full page aggregate
   * Handles upsert for translations and blocks
   */
  update(id: number, page: Partial<PageAggregate>, updatedById?: number): Promise<PageAggregate>;

  // ==========================================
  // DELETE OPERATIONS
  // ==========================================

  /**
   * Hard delete page permanently (cascade)
   */
  delete(id: number): Promise<void>;

  /**
   * Soft delete page (move to Trash)
   */
  softDelete(id: number): Promise<void>;

  /**
   * Restore soft deleted page
   */
  restore(id: number): Promise<void>;

  /**
   * Hard delete forever (same as delete, but explicit)
   */
  hardDelete(id: number): Promise<void>;

  // ==========================================
  // BULK OPERATIONS
  // ==========================================

  reorder(updates: Array<{ id: number; sortOrder: number }>): Promise<void>;

  publishMany(ids: number[]): Promise<void>;
  unpublishMany(ids: number[]): Promise<void>;

  /**
   * Bulk soft delete (Trash)
   */
  softDeleteMany(ids: number[]): Promise<void>;

  /**
   * Bulk restore from Trash
   */
  restoreMany(ids: number[]): Promise<void>;

  /**
   * Bulk hard delete forever
   */
  hardDeleteMany(ids: number[]): Promise<void>;

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Check if page exists
   */
  exists(id: number): Promise<boolean>;

  /**
   * Check if slug is unique for language
   */
  isSlugUnique(slug: string, languageId: number, excludePageId?: number): Promise<boolean>;

  // ==========================================
  // VERSIONING
  // ==========================================

  /**
   * Create a version snapshot
   */
  createVersion(pageId: number, languageId: number, snapshot: Record<string, any>): Promise<void>;

  /**
   * Get version history for a page
   */
  getVersions(
    pageId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PageVersion>>;

  /**
   * Get a single version by ID
   */
  getVersionById(versionId: number): Promise<any | null>;

  /**
   * Restore page translation content from snapshot
   */
  restoreVersion(versionId: number): Promise<void>;
}
