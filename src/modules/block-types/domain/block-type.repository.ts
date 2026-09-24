// src/modules/block-types/domain/block-type.repository.ts

import { BlockTypeDefinition } from '@prisma/client';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';

export interface BlockTypeFilters {
  scope?: 'page' | 'post' | 'global';
  isEnabled?: boolean;
  key?: string;
  searchTerm?: string;
  offset?: number;
  limit?: number;
}

export interface CreateBlockTypeData {
  key: string;
  label: string;
  scope: 'page' | 'post' | 'global';
  schema: Record<string, any>;
  isEnabled?: boolean; // optional, defaults to true
}

export interface UpdateBlockTypeData {
  key?: string;
  label?: string;
  scope?: 'page' | 'post' | 'global';
  schema?: Record<string, any>;
  isEnabled?: boolean;
}

export interface BlockTypeDefinitionEntity {
  id: bigint;
  key: string;
  label: string;
  scope: string;
  schema: Record<string, any>;
  isEnabled: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Repository interface for BlockType operations (Port)
 *
 * This interface defines the contract for data access.
 * Implementations (Adapters) can use Prisma, TypeORM, or any other data source.
 */
export interface IBlockTypeRepository {
  /**
   * Find all block types with optional filters
   */
  findAll(filters?: BlockTypeFilters): Promise<BlockTypeDefinition[]>;

  /**
   * Find a single block type by ID
   */
  findById(id: number): Promise<BlockTypeDefinition | null>;

  /**
   * Find a single block type by key
   */
  findByKey(key: string): Promise<BlockTypeDefinition | null>;

  /**
   * Check if a key exists (excluding a specific ID)
   */
  keyExists(key: string, excludeId?: number): Promise<boolean>;

  /**
   * Create a new block type
   */
  create(data: CreateBlockTypeData): Promise<BlockTypeDefinition>;

  /**
   * Update a block type
   */
  update(id: number, data: UpdateBlockTypeData): Promise<BlockTypeDefinition>;

  /**
   * Delete a block type
   */
  delete(id: number): Promise<BlockTypeDefinition>;

  /**
   * Toggle enabled status
   */
  toggleEnabled(id: number): Promise<BlockTypeDefinition>;

  /**
   * Count block types
   */
  count(filters?: BlockTypeFilters): Promise<number>;

  /**
   * Find block types by scope
   */
  findByScope(scope: 'page' | 'post' | 'global'): Promise<BlockTypeDefinition[]>;

  /**
   * Find paginated block types
   */
  findPaginated(
    filters: BlockTypeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<BlockTypeDefinition>>;
}
