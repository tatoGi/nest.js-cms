// src/modules/menus/domain/menu-item-translation.repository.ts

import { MenuItemTranslation } from './menu.aggregate';

export interface MenuItemTranslationFilters {
  menuItemId?: number;
  languageId?: number;
}

export interface CreateMenuItemTranslationData {
  menuItemId: number;
  languageId: number;
  label: string;
  slug: string;
}

export interface UpdateMenuItemTranslationData {
  label?: string;
  slug?: string;
}

export interface IMenuItemTranslationRepository {
  /**
   * Find all translations with optional filters
   */
  findAll(filters?: MenuItemTranslationFilters): Promise<MenuItemTranslation[]>;

  /**
   * Find translation by ID
   */
  findById(id: number): Promise<MenuItemTranslation | null>;

  /**
   * Find translation by menu item ID and language ID
   */
  findByMenuItemAndLanguage(
    menuItemId: number,
    languageId: number,
  ): Promise<MenuItemTranslation | null>;

  /**
   * Find translations by menu item ID
   */
  findByMenuItemId(menuItemId: number): Promise<MenuItemTranslation[]>;

  /**
   * Create a new translation
   */
  create(data: CreateMenuItemTranslationData): Promise<MenuItemTranslation>;

  /**
   * Create multiple translations
   */
  createMany(data: CreateMenuItemTranslationData[]): Promise<MenuItemTranslation[]>;

  /**
   * Update an existing translation
   */
  update(id: number, data: UpdateMenuItemTranslationData): Promise<MenuItemTranslation>;

  /**
   * Upsert translation (create or update)
   */
  upsert(
    menuItemId: number,
    languageId: number,
    data: UpdateMenuItemTranslationData,
  ): Promise<MenuItemTranslation>;

  /**
   * Delete a translation
   */
  delete(id: number): Promise<MenuItemTranslation>;

  /**
   * Delete all translations for a menu item
   */
  deleteByMenuItemId(menuItemId: number): Promise<void>;
}
