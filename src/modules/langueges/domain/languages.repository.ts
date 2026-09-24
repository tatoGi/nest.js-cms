// src/modules/languages/domain/languages.repository.ts

import { Language } from '@prisma/client';
import { TextDirection } from '@prisma/client';

/**
 * Filters for querying languages
 */
export interface LanguageFilters {
  code?: string;
  isActive?: boolean;
  isDefault?: boolean;
  direction?: TextDirection;
  searchTerm?: string; // searches code + name
}

/**
 * Data required to create a language
 */
export interface CreateLanguageData {
  code: string;
  name: string;
  englishName?: string;
  georgianName?: string;
  flagEmoji?: string;
  direction?: TextDirection;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

/**
 * Data allowed to update a language
 */
export interface UpdateLanguageData {
  code?: string;
  name?: string;
  englishName?: string | null;
  georgianName?: string | null;
  flagEmoji?: string | null;
  direction?: TextDirection;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

/**
 * Language domain entity (API-safe)
 */
export interface LanguageEntity {
  id: number;
  code: string;
  name: string;
  englishName?: string | null;
  georgianName?: string | null;
  flagEmoji?: string | null;
  direction?: TextDirection;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repository interface for Language operations (Port)
 *
 * Implementations can use Prisma, TypeORM, etc.
 */
export interface ILanguageRepository {
  /**
   * Find all languages with optional filters
   */
  findAll(filters?: LanguageFilters): Promise<Language[]>;

  /**
   * Find a language by ID
   */
  findById(id: number): Promise<Language | null>;

  /**
   * Find a language by code
   */
  findByCode(code: string): Promise<Language | null>;

  /**
   * Check if a language code exists (excluding a specific ID)
   */
  codeExists(code: string, excludeId?: number): Promise<boolean>;

  /**
   * Create a new language
   */
  create(data: CreateLanguageData): Promise<Language>;

  /**
   * Update a language
   */
  update(id: number, data: UpdateLanguageData): Promise<Language>;

  /**
   * Delete a language
   */
  delete(id: number): Promise<Language>;

  /**
   * Toggle active status
   */
  toggleActive(id: number): Promise<Language>;

  /**
   * Count languages
   */
  count(filters?: LanguageFilters): Promise<number>;

  /**
   * Find active languages
   */
  findActive(): Promise<Language[]>;

  /**
   * Find default language
   */
  findDefault(): Promise<Language | null>;
}
