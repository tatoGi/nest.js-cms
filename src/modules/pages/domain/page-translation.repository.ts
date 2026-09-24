// src/modules/pages/domain/page-translation.repository.ts

import { PageTranslation } from '@prisma/client';

export interface PageTranslationFilters {
  pageId?: number;
  languageId?: number;
  slug?: string;
}

export interface CreatePageTranslationData {
  pageId: number;
  languageId: number;
  title: string;
  slug: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: Date | null;
}

export interface UpdatePageTranslationData {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: Date | null;
}

export interface IPageTranslationRepository {
  /**
   * Find all translations with optional filters
   */
  findAll(filters?: PageTranslationFilters): Promise<PageTranslation[]>;

  /**
   * Find translation by ID
   */
  findById(id: number): Promise<PageTranslation | null>;

  /**
   * Find translation by page ID and language ID
   */
  findByPageAndLanguage(pageId: number, languageId: number): Promise<PageTranslation | null>;

  /**
   * Find translation by slug
   */
  findBySlug(slug: string): Promise<PageTranslation | null>;

  /**
   * Create a new translation
   */
  create(data: CreatePageTranslationData): Promise<PageTranslation>;

  /**
   * Update an existing translation
   */
  update(id: number, data: UpdatePageTranslationData): Promise<PageTranslation>;

  /**
   * Upsert translation (create or update)
   */
  upsert(
    pageId: number,
    languageId: number,
    data: UpdatePageTranslationData,
  ): Promise<PageTranslation>;

  /**
   * Soft delete a translation
   */
  delete(id: number): Promise<PageTranslation>;

  /**
   * Soft delete all translations for a page
   */
  deleteByPageId(pageId: number): Promise<void>;

  /**
   * Check if slug is unique
   */
  isSlugUnique(slug: string, excludeId?: number): Promise<boolean>;
}
