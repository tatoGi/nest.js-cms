// src/modules/menus/api/controllers/admin-menus.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { Locale } from '@/common/decorators/locale.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { MenusService } from '../../application/menus.service';
import { MenusPermissions } from '../../application/menus.permissions';

import {
  CreateMenuAggregateDto,
  UpdateMenuAggregateDto,
  MenuAggregateResponseDto,
  MenuQueryDto,
  MenuItemQueryDto,
  MenuListItemDto,
  MenuItemListDto,
  MenuItemResponseDto,
  AddMenuItemDto,
  UpdateMenuItemDto,
  ReorderMenuItemsDto,
} from '../../dto';

import { MenuMapper } from '../mapper/menu.mapper';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';
import { ApiIdParam, ApiStandardResponses } from '@/common/decorators/api-decorators';
import { PaginatedResponseDto, PaginationQueryDto } from '@/common/pagination';

@ApiTags('Admin - Menus')
@Controller('admin/menus')
@UseInterceptors(CacheInterceptor('menus'))
@ApiStandardResponses()
export class AdminMenusController {
  constructor(private readonly menusService: MenusService) {}

  // --------------------------------------------------
  // Create Menu
  // --------------------------------------------------
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MenusPermissions.CREATE_MENUS)
  @ApiOperation({
    summary: 'Create menu',
    description: 'Creates a new menu with optional items',
  })
  @ApiCreatedResponse({ type: MenuAggregateResponseDto })
  async create(
    @Body() dto: CreateMenuAggregateDto,
    @Req() req: Request,
  ): Promise<MenuAggregateResponseDto> {
    const aggregate = MenuMapper.toAggregate(dto);
    const created = await this.menusService.createAggregate(aggregate, getMeta(req));
    return MenuMapper.toResponse(created);
  }

  // --------------------------------------------------
  // List Menus
  // --------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menus list',
    description: 'Returns a list of menus',
  })
  @ApiOkResponse({ type: [MenuListItemDto] })
  async findAll(@Query() query: MenuQueryDto): Promise<MenuListItemDto[]> {
    return this.menusService.findAllList(query);
  }

  // --------------------------------------------------
  // List Menus Paginated
  // --------------------------------------------------
  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menus list with pagination',
    description: 'Returns a paginated list of menus',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<MenuListItemDto>> {
    return this.menusService.findAllListPaginated(query);
  }

  // --------------------------------------------------
  // Get Menu by ID
  // --------------------------------------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menu by ID',
    description: 'Returns the full menu aggregate including all items and translations',
  })
  @ApiIdParam('id', 'Menu ID')
  @ApiOkResponse({ type: MenuAggregateResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MenuAggregateResponseDto> {
    const menu = await this.menusService.findAggregateById(id);
    return MenuMapper.toResponse(menu);
  }

  // --------------------------------------------------
  // Get Menu by Slug
  // --------------------------------------------------
  @Get('by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menu by slug',
    description: 'Returns the full menu aggregate by slug',
  })
  @ApiParam({ name: 'slug', description: 'Menu slug', example: 'main-navigation' })
  @ApiOkResponse({ type: MenuAggregateResponseDto })
  async findBySlug(@Param('slug') slug: string): Promise<MenuAggregateResponseDto> {
    const menu = await this.menusService.findAggregateBySlug(slug);
    return MenuMapper.toResponse(menu);
  }

  // --------------------------------------------------
  // Update Menu
  // --------------------------------------------------
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.UPDATE_MENUS)
  @ApiOperation({
    summary: 'Update menu',
    description: 'Updates menu title, slug, or active status',
  })
  @ApiIdParam('id', 'Menu ID')
  @ApiOkResponse({ type: MenuAggregateResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuAggregateDto,
    @Req() req: Request,
  ): Promise<MenuAggregateResponseDto> {
    const existing = await this.menusService.findAggregateById(id);
    const aggregate = MenuMapper.toAggregateForUpdate(dto, existing);
    const updated = await this.menusService.updateAggregate(id, aggregate, getMeta(req));
    return MenuMapper.toResponse(updated);
  }

  // --------------------------------------------------
  // Delete Menu
  // --------------------------------------------------
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(MenusPermissions.DELETE_MENUS)
  @ApiOperation({
    summary: 'Delete menu',
    description: 'Permanently deletes a menu and all its items',
  })
  @ApiIdParam('id', 'Menu ID')
  @ApiNoContentResponse()
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.menusService.delete(id, getMeta(req));
  }

  // --------------------------------------------------
  // Check Slug Uniqueness
  // --------------------------------------------------
  @Get('check-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Check if slug is unique',
    description: 'Returns whether a slug is available',
  })
  @ApiParam({ name: 'slug', description: 'Slug to check' })
  @ApiQuery({ name: 'excludeMenuId', required: false, type: Number })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        isUnique: { type: 'boolean' },
        slug: { type: 'string' },
      },
    },
  })
  async checkSlugUnique(
    @Param('slug') slug: string,
    @Query('excludeMenuId') excludeMenuId?: string,
  ): Promise<{ isUnique: boolean; slug: string }> {
    const excludeId = excludeMenuId ? parseInt(excludeMenuId, 10) : undefined;
    const isUnique = await this.menusService.isSlugUnique(slug, excludeId);
    return { isUnique, slug };
  }

  // ==================================================
  // MENU ITEMS ENDPOINTS
  // ==================================================

  // --------------------------------------------------
  // Get Menu Items
  // --------------------------------------------------
  @Get(':menuId/items')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menu items',
    description: 'Returns all items for a menu',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiOkResponse({ type: [MenuItemListDto] })
  async findMenuItems(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Query() query: MenuItemQueryDto,
    @Locale() languageId: number,
  ): Promise<MenuItemListDto[]> {
    return this.menusService.findMenuItems(menuId, languageId, query.nested ?? true);
  }

  // --------------------------------------------------
  // Get Menu Item by ID
  // --------------------------------------------------
  @Get(':menuId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.VIEW_MENUS)
  @ApiOperation({
    summary: 'Get menu item by ID',
    description: 'Returns a single menu item with translations',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiIdParam('itemId', 'Menu Item ID')
  @ApiOkResponse({ type: MenuItemResponseDto })
  async findMenuItem(@Param('itemId', ParseIntPipe) itemId: number): Promise<MenuItemResponseDto> {
    return this.menusService.findMenuItemById(itemId);
  }

  // --------------------------------------------------
  // Create Menu Item
  // --------------------------------------------------
  @Post(':menuId/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MenusPermissions.CREATE_MENU_ITEMS)
  @ApiOperation({
    summary: 'Create menu item',
    description: 'Adds a new item to a menu',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiCreatedResponse({ type: MenuItemResponseDto })
  async createMenuItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Body() dto: AddMenuItemDto,
    @Req() req: Request,
  ): Promise<MenuItemResponseDto> {
    return this.menusService.createMenuItem(menuId, dto, getMeta(req));
  }

  // --------------------------------------------------
  // Update Menu Item
  // --------------------------------------------------
  @Patch(':menuId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MenusPermissions.UPDATE_MENU_ITEMS)
  @ApiOperation({
    summary: 'Update menu item',
    description: 'Updates an existing menu item',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiIdParam('itemId', 'Menu Item ID')
  @ApiOkResponse({ type: MenuItemResponseDto })
  async updateMenuItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateMenuItemDto,
    @Req() req: Request,
  ): Promise<MenuItemResponseDto> {
    return this.menusService.updateMenuItem(menuId, itemId, dto, getMeta(req));
  }

  // --------------------------------------------------
  // Delete Menu Item
  // --------------------------------------------------
  @Delete(':menuId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(MenusPermissions.DELETE_MENU_ITEMS)
  @ApiOperation({
    summary: 'Delete menu item',
    description: 'Removes an item from a menu (cascades to children)',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiIdParam('itemId', 'Menu Item ID')
  @ApiNoContentResponse()
  async deleteMenuItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ): Promise<void> {
    await this.menusService.deleteMenuItem(menuId, itemId, getMeta(req));
  }

  // --------------------------------------------------
  // Reorder Menu Items
  // --------------------------------------------------
  @Patch(':menuId/items/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(MenusPermissions.REORDER_MENU_ITEMS)
  @ApiOperation({
    summary: 'Reorder menu items',
    description: 'Updates the order and parent of multiple items',
  })
  @ApiIdParam('menuId', 'Menu ID')
  @ApiNoContentResponse()
  async reorderMenuItems(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Body() dto: ReorderMenuItemsDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.menusService.reorderMenuItems(menuId, dto.items, getMeta(req));
  }
}
