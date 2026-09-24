// src/modules/block-types/infrastructure/prisma-block-type.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BlockTypeDefinition } from '@prisma/client';
import {
  IBlockTypeRepository,
  BlockTypeFilters,
  CreateBlockTypeData,
  UpdateBlockTypeData,
} from '../domain/block-type.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';

@Injectable()
export class PrismaBlockTypeRepository implements IBlockTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters?: BlockTypeFilters): any {
    if (!filters) return {};

    const where: any = {};

    // ✅ Scope filtering with global included
    if (filters.scope) {
      if (filters.scope === 'global') {
        where.scope = 'global';
      } else {
        where.scope = {
          in: [filters.scope, 'global'],
        };
      }
    }

    if (typeof filters.isEnabled === 'boolean') {
      where.isEnabled = filters.isEnabled;
    }

    if (filters.key) {
      where.key = filters.key;
    }

    if (filters.searchTerm) {
      where.OR = [
        { key: { contains: filters.searchTerm, mode: 'insensitive' } },
        { label: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Find all block types with optional filters
   */
  async findAll(filters?: BlockTypeFilters): Promise<BlockTypeDefinition[]> {
    const where = this.buildWhereClause(filters);

    return this.prisma.blockTypeDefinition.findMany({
      where,
      orderBy: [{ label: 'asc' }],
    });
  }

  /**
   * Find a single block type by ID
   */
  async findById(id: number): Promise<BlockTypeDefinition | null> {
    return this.prisma.blockTypeDefinition.findUnique({
      where: { id },
    });
  }

  /**
   * Find a single block type by key
   */
  async findByKey(key: string): Promise<BlockTypeDefinition | null> {
    return this.prisma.blockTypeDefinition.findUnique({
      where: { key },
    });
  }

  /**
   * Check if a key exists (excluding a specific ID)
   */
  async keyExists(key: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.blockTypeDefinition.count({
      where: {
        key,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return count > 0;
  }

  /**
   * Create a new block type
   */
  async create(data: CreateBlockTypeData): Promise<BlockTypeDefinition> {
    return this.prisma.blockTypeDefinition.create({
      data: {
        key: data.key,
        label: data.label,
        scope: data.scope,
        schema: data.schema as any,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  /**
   * Update a block type
   */
  async update(id: number, data: UpdateBlockTypeData): Promise<BlockTypeDefinition> {
    const updateData: any = {};

    if (data.key !== undefined) updateData.key = data.key;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.schema !== undefined) updateData.schema = data.schema;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    return this.prisma.blockTypeDefinition.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a block type
   */
  async delete(id: number): Promise<BlockTypeDefinition> {
    return this.prisma.blockTypeDefinition.delete({
      where: { id },
    });
  }

  /**
   * Toggle enabled status
   */
  async toggleEnabled(id: number): Promise<BlockTypeDefinition> {
    const blockType = await this.findById(id);

    if (!blockType) {
      throw new Error(`Block type with ID ${id} not found`);
    }

    return this.prisma.blockTypeDefinition.update({
      where: { id },
      data: { isEnabled: !blockType.isEnabled },
    });
  }

  /**
   * Count block types
   */
  async count(filters?: BlockTypeFilters): Promise<number> {
    const where = this.buildWhereClause(filters);

    return this.prisma.blockTypeDefinition.count({ where });
  }

  /**
   * Find block types by scope
   */
  async findByScope(scope: 'page' | 'post' | 'global'): Promise<BlockTypeDefinition[]> {
    return this.prisma.blockTypeDefinition.findMany({
      where: {
        scope,
        isEnabled: true,
      },
      orderBy: [{ label: 'asc' }],
    });
  }
  /**
   * Find paginated block types
   */
  async findPaginated(
    filters: BlockTypeFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<BlockTypeDefinition>> {
    const where = this.buildWhereClause(filters);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    return prismaPaginate<BlockTypeDefinition>(
      this.prisma.blockTypeDefinition,
      {
        where,
        orderBy: pagination.sortBy
          ? { [pagination.sortBy]: pagination.sortOrder ?? 'asc' }
          : { label: 'asc' },
      },
      { page, limit, skip, sortBy: pagination.sortBy, sortOrder: pagination.sortOrder },
    );
  }

  /**
   * Find duplicate keys
   */
  async findDuplicateKeys(): Promise<string[]> {
    const result = await this.prisma.$queryRaw<Array<{ key: string; count: number }>>`
      SELECT key, COUNT(*) as count
      FROM block_type_definitions
      GROUP BY key
      HAVING COUNT(*) > 1
    `;

    return result.map((r) => r.key);
  }
}
