// src/modules/pages/domain/page-block.repository.ts

import { PageContentBlock } from '@prisma/client';

export interface PageBlockFilters {
  translationId?: number;
  type?: string;
}

export interface CreatePageBlockData {
  translationId: number;
  type: string;
  data: Record<string, any>;
  sortOrder: number;
}

export interface UpdatePageBlockData {
  type?: string;
  data?: Record<string, any>;
  sortOrder?: number;
}

export interface IPageBlockRepository {
  findAll(filters?: PageBlockFilters): Promise<PageContentBlock[]>;
  findById(id: number): Promise<PageContentBlock | null>;
  findByTranslationId(translationId: number): Promise<PageContentBlock[]>;
  create(data: CreatePageBlockData): Promise<PageContentBlock>;
  createMany(data: CreatePageBlockData[]): Promise<PageContentBlock[]>;
  update(id: number, data: UpdatePageBlockData): Promise<PageContentBlock>;
  upsert(id: number | undefined, data: CreatePageBlockData): Promise<PageContentBlock>;
  delete(id: number): Promise<PageContentBlock>;
  deleteByTranslationId(translationId: number): Promise<void>;
  reorder(translationId: number, blockIds: number[]): Promise<void>;
}
