import { ReorderItemData } from '.';
import { MenuAggregate, MenuItem } from './menu.aggregate';
import { MenuFilters, PaginatedResult, PaginationOptions } from './menu.repository';

export interface IMenuAggregateRepository {
  /**
   * Find full menu aggregate by ID (with all items and translations)
   */
  findById(id: number): Promise<MenuAggregate | null>;

  /**
   * Find menu aggregate by slug
   */
  findBySlug(slug: string): Promise<MenuAggregate | null>;

  /**
   * Find all menu aggregates with filters
   */
  findAll(filters?: MenuFilters, pagination?: PaginationOptions): Promise<MenuAggregate[]>;

  /**
   * Find paginated menu aggregates
   */
  findPaginated(
    filters?: MenuFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<MenuAggregate>>;

  /**
   * Create full menu aggregate
   */
  create(menu: MenuAggregate): Promise<MenuAggregate>;

  /**
   * ❌ Root-only update (kept for backward compatibility)
   * Updates menu fields only (no items / translations)
   */
  update(id: number, menu: Partial<MenuAggregate>): Promise<MenuAggregate>;

  /**
   * ✅ FULL aggregate save
   * - updates menu
   * - creates / updates / deletes items
   * - creates / updates / deletes translations
   */
  saveAggregate(menu: MenuAggregate): Promise<MenuAggregate>;

  /**
   * Delete menu aggregate (cascades to items and translations)
   */
  delete(id: number): Promise<void>;

  /**
   * Check if menu exists
   */
  exists(id: number): Promise<boolean>;

  /**
   * Check if slug is unique
   */
  isSlugUnique(slug: string, excludeId?: number): Promise<boolean>;

  // ==========================================
  // MENU ITEM OPERATIONS (fine-grained)
  // ==========================================

  findMenuItems(menuId: number, nested?: boolean): Promise<MenuItem[]>;

  findMenuItemById(id: number): Promise<MenuItem | null>;

  createMenuItem(menuId: number, item: MenuItem): Promise<MenuItem>;

  updateMenuItem(id: number, item: Partial<MenuItem>): Promise<MenuItem>;

  deleteMenuItem(id: number): Promise<void>;

  reorderMenuItems(menuId: number, items: ReorderItemData[]): Promise<void>;

  getMaxOrder(menuId: number, parentId?: number | null): Promise<number>;
}
