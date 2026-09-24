// src/modules/block-types/api/controllers/admin-block-types.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';

// Service & Permissions
import { BlockTypesService } from '../../application/block-types.service';
import { BlockTypesPermissions } from '../../application/block-types.permissions';

// DTOs - Option 1: Import from index
import {
  CreateBlockTypeDto,
  UpdateBlockTypeDto,
  BlockTypeQueryDto,
  BlockTypePaginatedQueryDto,
  BlockTypeResponseDto,
} from '../../dto';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';

// Guards & Interceptors
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';

// Common Decorators
import { ApiIdParam, ApiStandardResponses } from '@/common/decorators/api-decorators';

@ApiTags('Admin - Block Types')
@Controller('admin/block-types')
@RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
@UseInterceptors(CacheInterceptor('block-types'))
@ApiStandardResponses()
export class AdminBlockTypesController {
  constructor(private readonly blockTypesService: BlockTypesService) {}

  /**
   * Create a new block type
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(BlockTypesPermissions.CREATE_BLOCK_TYPE)
  @ApiOperation({
    summary: 'Create a new block type',
    description: 'Creates a new block type definition with schema',
  })
  @ApiCreatedResponse({
    description: 'Block type created successfully',
    type: BlockTypeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Block type key already exists',
  })
  async create(@Body() createBlockTypeDto: CreateBlockTypeDto): Promise<BlockTypeResponseDto> {
    return this.blockTypesService.create(createBlockTypeDto);
  }

  /**
   * Get all block types
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
  @ApiOperation({
    summary: 'Get all block types',
    description: 'Retrieves all block types with optional filters',
  })
  @ApiOkResponse({
    description: 'Block types retrieved successfully',
    type: [BlockTypeResponseDto],
  })
  async findAll(@Query() query: BlockTypeQueryDto): Promise<BlockTypeResponseDto[]> {
    return this.blockTypesService.findAll({
      scope: query.scope,
      isEnabled: query.isEnabled,
      searchTerm: query.searchTerm,
      offset: query.offset,
      limit: query.limit,
    });
  }

  /**
   * Get paginated block types
   */
  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
  @ApiOperation({
    summary: 'Get paginated block types',
    description: 'Retrieves block types with pagination, filtering, and sorting',
  })
  @ApiOkResponse({
    description: 'Paginated block types retrieved successfully',
  })
  async findAllPaginated(
    @Query() query: BlockTypePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<BlockTypeResponseDto>> {
    return this.blockTypesService.findAllPaginated(query);
  }

  /**
   * Get block types statistics
   */
  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
  @ApiOperation({
    summary: 'Get block types statistics',
    description: 'Retrieves statistics about block types',
  })
  @ApiOkResponse({
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 15 },
        enabled: { type: 'number', example: 12 },
        disabled: { type: 'number', example: 3 },
        byScope: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 8 },
            post: { type: 'number', example: 5 },
            global: { type: 'number', example: 2 },
          },
        },
      },
    },
  })
  async getStatistics() {
    return this.blockTypesService.getStatistics();
  }

  /**
   * Get a block type by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
  @ApiOperation({
    summary: 'Get a block type by ID',
    description: 'Retrieves a single block type by its ID',
  })
  @ApiIdParam('id', 'Block type ID')
  @ApiOkResponse({
    description: 'Block type retrieved successfully',
    type: BlockTypeResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<BlockTypeResponseDto> {
    return this.blockTypesService.findOne(id);
  }

  /**
   * Get a block type by key
   */
  @Get('key/:key')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.VIEW_BLOCK_TYPES)
  @ApiOperation({
    summary: 'Get a block type by key',
    description: 'Retrieves a block type by its unique key',
  })
  @ApiIdParam('key', 'Block type key')
  @ApiOkResponse({
    description: 'Block type retrieved successfully',
    type: BlockTypeResponseDto,
  })
  async findByKey(@Param('key') key: string): Promise<BlockTypeResponseDto> {
    return this.blockTypesService.findByKey(key);
  }

  /**
   * Update a block type
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.UPDATE_BLOCK_TYPE)
  @ApiOperation({
    summary: 'Update a block type',
    description: 'Updates an existing block type',
  })
  @ApiIdParam('id', 'Block type ID')
  @ApiOkResponse({
    description: 'Block type updated successfully',
    type: BlockTypeResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBlockTypeDto: UpdateBlockTypeDto,
  ): Promise<BlockTypeResponseDto> {
    return this.blockTypesService.update(id, updateBlockTypeDto);
  }

  /**
   * Delete a block type
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(BlockTypesPermissions.DELETE_BLOCK_TYPE)
  @ApiOperation({
    summary: 'Delete a block type',
    description: 'Permanently deletes a block type',
  })
  @ApiIdParam('id', 'Block type ID')
  @ApiNoContentResponse({
    description: 'Block type deleted successfully',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.blockTypesService.remove(id);
  }

  /**
   * Toggle block type enabled status
   */
  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BlockTypesPermissions.TOGGLE_BLOCK_TYPE)
  @ApiOperation({
    summary: 'Toggle block type status',
    description: 'Toggles the enabled/disabled status of a block type',
  })
  @ApiIdParam('id', 'Block type ID')
  @ApiOkResponse({
    description: 'Block type status toggled successfully',
    type: BlockTypeResponseDto,
  })
  async toggleEnabled(@Param('id', ParseIntPipe) id: number): Promise<BlockTypeResponseDto> {
    return this.blockTypesService.toggleEnabled(id);
  }
}
