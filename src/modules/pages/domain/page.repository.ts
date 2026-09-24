// src/modules/pages/domain/page.repository.ts

import { PaginationOptions } from '@/common/pagination';
import { Page } from '@prisma/client';

export interface PageFilters {
  parentId?: number | null;
  templateId?: number;
  published?: boolean;
  showInMenu?: boolean;
  isHome?: boolean;
  searchTerm?: string;
  createdById?: number;
  updatedById?: number;
}

export interface CreatePageData {
  parentId?: number | null;
  templateId: number;
  sortOrder?: number;
  published?: boolean;
  showInMenu?: boolean;
  isHome?: boolean;
  featureImageId?: number | null;
  createdById?: number | null;
}

export interface UpdatePageData {
  parentId?: number | null;
  templateId?: number;
  sortOrder?: number;
  published?: boolean;
  showInMenu?: boolean;
  isHome?: boolean;
  featureImageId?: number | null;
  updatedById?: number | null;
}

export interface IPageRepository {
  findAll(filters?: PageFilters, pagination?: PaginationOptions): Promise<Page[]>;
  findById(id: number): Promise<Page | null>;
  findByParentId(parentId: number | null): Promise<Page[]>;
  create(data: CreatePageData): Promise<Page>;
  update(id: number, data: UpdatePageData): Promise<Page>;
  delete(id: number): Promise<Page>;
  softDelete(id: number): Promise<Page>;
  count(filters?: PageFilters): Promise<number>;
  exists(id: number): Promise<boolean>;
}
