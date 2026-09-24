// src/modules/menus/application/menus.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { MenuAggregate, MenuItem } from '../domain/menu.aggregate';
import {
  MenuFilters,
  PaginationOptions,
  IMenuAggregateRepository,
  ReorderItemData,
} from '../domain';
import {
  MenuQueryDto,
  MenuListItemDto,
  MenuItemListDto,
  MenuItemResponseDto,
  AddMenuItemDto,
  UpdateMenuItemDto,
  PagePaginatedQueryDto,
} from '../dto';
import { MenuMapper } from '../api/mapper/menu.mapper';
import { PaginatedResponseDto } from '@/common/pagination';
import {
  MenuNotFoundException,
  MenuItemNotFoundException,
  MenuDuplicateException,
} from '@/common/exceptions';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { MenusPermissions } from './menus.permissions';

@Injectable()
export class MenusService {
  constructor(
    @Inject('IMenuAggregateRepository')
    private readonly menuAggregateRepository: IMenuAggregateRepository,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // AGGREGATE OPERATIONS
  // ==========================================

  async createAggregate(aggregate: MenuAggregate, meta?: ActionMeta): Promise<MenuAggregate> {
    const slugExists = await this.menuAggregateRepository.isSlugUnique(aggregate.slug);
    if (!slugExists) {
      throw new MenuDuplicateException(aggregate.slug);
    }

    const created = await this.menuAggregateRepository.create(aggregate);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.CREATE_MENUS,
      targetType: 'menu',
      targetId: created.id ?? undefined,
      after: { slug: created.slug, name: created.title },
      ip: meta?.ip,
    });
    return created;
  }

  async findAggregateById(id: number): Promise<MenuAggregate> {
    const menu = await this.menuAggregateRepository.findById(id);

    if (!menu) {
      throw new MenuNotFoundException(id);
    }

    return menu;
  }

  async findAggregateBySlug(slug: string): Promise<MenuAggregate> {
    const menu = await this.menuAggregateRepository.findBySlug(slug);

    if (!menu) {
      throw new MenuNotFoundException(slug);
    }

    return menu;
  }

  async findAllAggregates(
    query?: MenuQueryDto,
    pagination?: PaginationOptions,
  ): Promise<MenuAggregate[]> {
    const filters = this.mapQueryToFilters(query);
    return this.menuAggregateRepository.findAll(filters, pagination);
  }

  async updateAggregate(
    id: number,
    aggregate: MenuAggregate,
    meta?: ActionMeta,
  ): Promise<MenuAggregate> {
    await this.findAggregateById(id);

    if (aggregate.slug) {
      const isUnique = await this.menuAggregateRepository.isSlugUnique(aggregate.slug, id);
      if (!isUnique) {
        throw new MenuDuplicateException(aggregate.slug);
      }
    }

    aggregate.id = id;

    const updated = await this.menuAggregateRepository.saveAggregate(aggregate);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.UPDATE_MENUS,
      targetType: 'menu',
      targetId: id,
      after: { slug: updated.slug, name: updated.title },
      ip: meta?.ip,
    });
    return updated;
  }

  async delete(id: number, meta?: ActionMeta): Promise<void> {
    const menu = await this.findAggregateById(id);
    await this.menuAggregateRepository.delete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.DELETE_MENUS,
      targetType: 'menu',
      targetId: id,
      before: { slug: menu.slug, name: menu.title },
      ip: meta?.ip,
    });
  }

  // ==========================================
  // LIST OPERATIONS
  // ==========================================

  async findAllList(query?: MenuQueryDto): Promise<MenuListItemDto[]> {
    const filters = this.mapQueryToFilters(query);
    const aggregates = await this.menuAggregateRepository.findAll(filters);
    return MenuMapper.toListItems(aggregates);
  }

  async findAllListPaginated(
    query: PagePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<MenuListItemDto>> {
    const filters = this.mapQueryToFilters(query);
    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.menuAggregateRepository.findPaginated(filters, paginationOptions);

    return {
      data: MenuMapper.toListItems(result.data),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  // ==========================================
  // MENU ITEM OPERATIONS
  // ==========================================

  async findMenuItems(
    menuId: number,
    languageId: number = 1,
    nested: boolean = true,
  ): Promise<MenuItemListDto[]> {
    await this.findAggregateById(menuId);

    const items = await this.menuAggregateRepository.findMenuItems(menuId, nested);
    return items.map((item) => MenuMapper.toItemListDto(item, languageId));
  }

  async findMenuItemById(id: number): Promise<MenuItemResponseDto> {
    const item = await this.menuAggregateRepository.findMenuItemById(id);

    if (!item) {
      throw new MenuItemNotFoundException(id);
    }

    return MenuMapper.toItemResponse(item);
  }

  async createMenuItem(
    menuId: number,
    dto: AddMenuItemDto,
    meta?: ActionMeta,
  ): Promise<MenuItemResponseDto> {
    await this.findAggregateById(menuId);

    if (dto.parentId) {
      const parent = await this.menuAggregateRepository.findMenuItemById(dto.parentId);
      if (!parent) {
        throw new MenuItemNotFoundException(dto.parentId);
      }
      if (parent.menuId !== menuId) {
        throw new BadRequestException('Parent item must belong to the same menu');
      }
    }

    if (!dto.translations?.length) {
      throw new BadRequestException('At least one translation is required');
    }

    const sortOrder =
      dto.sortOrder ?? (await this.menuAggregateRepository.getMaxOrder(menuId, dto.parentId)) + 1;

    const item: MenuItem = {
      menuId,
      parentId: dto.parentId ?? null,
      sortOrder,
      type: dto.type,
      url: dto.type === 'custom' ? dto.url : null,
      target: dto.target ?? '_self',
      referenceId: dto.type !== 'custom' ? dto.referenceId : null,
      translations: dto.translations.map((t) => ({
        languageId: t.languageId,
        label: t.label,
        slug: t.slug,
      })),
    };

    const created = await this.menuAggregateRepository.createMenuItem(menuId, item);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.CREATE_MENU_ITEMS,
      targetType: 'menu_item',
      targetId: created.id ?? undefined,
      after: {
        menuId,
        type: created.type,
        translations: created.translations?.map((t) => ({
          languageId: t.languageId,
          label: t.label,
        })),
      },
      ip: meta?.ip,
    });
    return MenuMapper.toItemResponse(created);
  }

  async updateMenuItem(
    menuId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
    meta?: ActionMeta,
  ): Promise<MenuItemResponseDto> {
    const item = await this.menuAggregateRepository.findMenuItemById(itemId);
    if (!item) {
      throw new MenuItemNotFoundException(itemId);
    }
    if (item.menuId !== menuId) {
      throw new BadRequestException('Menu item does not belong to this menu');
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === itemId) {
        throw new BadRequestException('Item cannot be its own parent');
      }
      const parent = await this.menuAggregateRepository.findMenuItemById(dto.parentId);
      if (!parent) {
        throw new MenuItemNotFoundException(dto.parentId);
      }
      if (parent.menuId !== menuId) {
        throw new BadRequestException('Parent item must belong to the same menu');
      }
    }

    const updateData: Partial<MenuItem> = {
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      ...(dto.sortOrder !== undefined && { order: dto.sortOrder }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.target !== undefined && { target: dto.target }),
    };

    if (dto.type !== undefined) {
      if (dto.type === 'custom') {
        updateData.url = dto.url ?? null;
        updateData.referenceId = null;
      } else {
        updateData.url = null;
        updateData.referenceId = dto.referenceId ?? null;
      }
    } else {
      if (dto.url !== undefined) updateData.url = dto.url;
      if (dto.referenceId !== undefined) updateData.referenceId = dto.referenceId;
    }

    if (dto.translations?.length) {
      updateData.translations = dto.translations.map((t) => ({
        id: t.id,
        languageId: t.languageId,
        label: t.label,
        slug: t.slug,
      }));
    }

    const updated = await this.menuAggregateRepository.updateMenuItem(itemId, updateData);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.UPDATE_MENU_ITEMS,
      targetType: 'menu_item',
      targetId: itemId,
      after: { menuId, type: updated.type },
      ip: meta?.ip,
    });
    return MenuMapper.toItemResponse(updated);
  }

  async deleteMenuItem(menuId: number, itemId: number, meta?: ActionMeta): Promise<void> {
    const item = await this.menuAggregateRepository.findMenuItemById(itemId);
    if (!item) {
      throw new MenuItemNotFoundException(itemId);
    }
    if (item.menuId !== menuId) {
      throw new BadRequestException('Menu item does not belong to this menu');
    }

    await this.menuAggregateRepository.deleteMenuItem(itemId);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.DELETE_MENU_ITEMS,
      targetType: 'menu_item',
      targetId: itemId,
      before: { menuId, type: item.type },
      ip: meta?.ip,
    });
  }

  async reorderMenuItems(
    menuId: number,
    items: ReorderItemData[],
    meta?: ActionMeta,
  ): Promise<void> {
    await this.findAggregateById(menuId);

    for (const item of items) {
      const menuItem = await this.menuAggregateRepository.findMenuItemById(item.id);
      if (!menuItem) {
        throw new MenuItemNotFoundException(item.id);
      }
      if (menuItem.menuId !== menuId) {
        throw new BadRequestException(`Menu item ${item.id} does not belong to this menu`);
      }
    }

    await this.menuAggregateRepository.reorderMenuItems(menuId, items);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: MenusPermissions.REORDER_MENU_ITEMS,
      targetType: 'menu',
      targetId: menuId,
      after: { itemCount: items.length },
      ip: meta?.ip,
    });
  }

  // ==========================================
  // PUBLIC MENU OPERATIONS
  // ==========================================

  async findActiveMenus(): Promise<MenuAggregate[]> {
    return this.menuAggregateRepository.findAll({ isActive: true });
  }

  async findActiveMenuBySlug(slug: string): Promise<MenuAggregate | null> {
    const menu = await this.menuAggregateRepository.findBySlug(slug);
    if (!menu || !menu.isActive) {
      return null;
    }
    return menu;
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  async isSlugUnique(slug: string, excludeMenuId?: number): Promise<boolean> {
    return this.menuAggregateRepository.isSlugUnique(slug, excludeMenuId);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private mapQueryToFilters(query?: MenuQueryDto): MenuFilters {
    if (!query) return {};

    return {
      isActive: query.isActive,
      slug: query.slug,
      searchTerm: query.search,
    };
  }
}
