// src/modules/menus/domain/menu.repository.ts

import { Menu } from './menu.aggregate';

export interface MenuFilters {
  isActive?: boolean;
  slug?: string;
  searchTerm?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateMenuData {
  title: string;
  slug: string;
  isActive?: boolean;
}

export interface UpdateMenuData {
  title?: string;
  slug?: string;
  isActive?: boolean;
}

export interface IMenuRepository {
  findAll(filters?: MenuFilters, pagination?: PaginationOptions): Promise<Menu[]>;
  findById(id: number): Promise<Menu | null>;
  findBySlug(slug: string): Promise<Menu | null>;
  create(data: CreateMenuData): Promise<Menu>;
  update(id: number, data: UpdateMenuData): Promise<Menu>;
  delete(id: number): Promise<Menu>;
  count(filters?: MenuFilters): Promise<number>;
  exists(id: number): Promise<boolean>;
  isSlugUnique(slug: string, excludeId?: number): Promise<boolean>;
}
