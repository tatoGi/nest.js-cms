// src/modules/block-types/application/block-types.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { BlockTypeDefinition } from '@prisma/client';
import { IBlockTypeRepository, BlockTypeFilters } from '../domain/block-type.repository';
import { CreateBlockTypeDto, UpdateBlockTypeDto, BlockTypePaginatedQueryDto } from '../dto';
import {
  BlockTypeNotFoundException,
  BlockTypeDuplicateException,
  InvalidSchemaException,
} from '@/common/exceptions';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';

@Injectable()
export class BlockTypesService {
  constructor(
    @Inject('IBlockTypeRepository')
    private readonly blockTypeRepository: IBlockTypeRepository,
  ) {}

  /**
   * Get all block types with optional filters
   */
  async findAll(filters?: BlockTypeFilters): Promise<BlockTypeDefinition[]> {
    return this.blockTypeRepository.findAll(filters);
  }

  /**
   * Get paginated block types
   */
  async findAllPaginated(
    query: BlockTypePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<BlockTypeDefinition>> {
    const result = await this.blockTypeRepository.findPaginated(
      {
        scope: query.scope,
        isEnabled: query.isEnabled,
        searchTerm: query.searchTerm,
      },
      {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );

    return new PaginatedResponseDto(
      result.data,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  /**
   * Get a single block type by ID
   */
  async findOne(id: number): Promise<BlockTypeDefinition> {
    const blockType = await this.blockTypeRepository.findById(id);

    if (!blockType) {
      throw new BlockTypeNotFoundException(id);
    }

    return blockType;
  }

  /**
   * Get a block type by key
   */
  async findByKey(key: string): Promise<BlockTypeDefinition> {
    const blockType = await this.blockTypeRepository.findByKey(key);

    if (!blockType) {
      throw new BlockTypeNotFoundException(key);
    }

    return blockType;
  }

  /**
   * Get block types by scope
   */
  async findByScope(scope: 'page' | 'post' | 'global'): Promise<BlockTypeDefinition[]> {
    return this.blockTypeRepository.findByScope(scope);
  }

  /**
   * Create a new block type
   */
  async create(createBlockTypeDto: CreateBlockTypeDto): Promise<BlockTypeDefinition> {
    // Check if key already exists
    const keyExists = await this.blockTypeRepository.keyExists(createBlockTypeDto.key);

    if (keyExists) {
      throw new BlockTypeDuplicateException(createBlockTypeDto.key);
    }

    // Validate schema structure
    this.validateSchema(createBlockTypeDto.schema);

    return this.blockTypeRepository.create({
      key: createBlockTypeDto.key,
      label: createBlockTypeDto.label,
      scope: createBlockTypeDto.scope,
      schema: createBlockTypeDto.schema,
      isEnabled: createBlockTypeDto.isEnabled ?? true,
    });
  }

  /**
   * Update a block type
   */
  async update(id: number, updateBlockTypeDto: UpdateBlockTypeDto): Promise<BlockTypeDefinition> {
    // Check if block type exists
    await this.findOne(id);

    // Check if key is being changed and if it already exists
    if (updateBlockTypeDto.key) {
      const keyExists = await this.blockTypeRepository.keyExists(updateBlockTypeDto.key, id);

      if (keyExists) {
        throw new BlockTypeDuplicateException(updateBlockTypeDto.key);
      }
    }

    // Validate schema if provided
    if (updateBlockTypeDto.schema) {
      this.validateSchema(updateBlockTypeDto.schema);
    }

    return this.blockTypeRepository.update(id, updateBlockTypeDto);
  }

  /**
   * Delete a block type
   */
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.blockTypeRepository.delete(id);
  }

  /**
   * Toggle enabled status
   */
  async toggleEnabled(id: number): Promise<BlockTypeDefinition> {
    await this.findOne(id);
    return this.blockTypeRepository.toggleEnabled(id);
  }

  /**
   * Get block type statistics
   */
  async getStatistics(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byScope: {
      page: number;
      post: number;
      global: number;
    };
  }> {
    const [total, enabled, pageCount, postCount, globalCount] = await Promise.all([
      this.blockTypeRepository.count(),
      this.blockTypeRepository.count({ isEnabled: true }),
      this.blockTypeRepository.count({ scope: 'page' }),
      this.blockTypeRepository.count({ scope: 'post' }),
      this.blockTypeRepository.count({ scope: 'global' }),
    ]);

    return {
      total,
      enabled,
      disabled: total - enabled,
      byScope: {
        page: pageCount,
        post: postCount,
        global: globalCount,
      },
    };
  }

  /**
   * Validate schema structure
   */
  private validateSchema(schema: any): void {
    if (!schema || typeof schema !== 'object') {
      throw new InvalidSchemaException('Schema must be a valid JSON object');
    }

    if (!schema.fields || !Array.isArray(schema.fields)) {
      throw new InvalidSchemaException('Schema must contain a "fields" array');
    }

    for (const field of schema.fields) {
      if (!field.key || typeof field.key !== 'string') {
        throw new InvalidSchemaException('Each field must have a "key" property');
      }

      if (!field.type || typeof field.type !== 'string') {
        throw new InvalidSchemaException('Each field must have a "type" property');
      }

      if (!field.label || typeof field.label !== 'string') {
        throw new InvalidSchemaException('Each field must have a "label" property');
      }
    }
  }
}
