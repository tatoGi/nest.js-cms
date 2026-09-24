// src/modules/menus/api/mapper/menu.mapper.ts

import {
  CreateMenuAggregateDto,
  UpdateMenuAggregateDto,
  MenuAggregateResponseDto,
  MenuItemResponseDto,
  MenuListItemDto,
  MenuItemListDto,
  UpdateMenuItemTranslationDto,
  UpdateMenuItemDto,
} from '../../dto';

import { MenuAggregate, MenuItem, MenuItemTranslation } from '../../domain';

/**
 * Mapper to convert between DTOs and Domain Aggregates
 */
export class MenuMapper {
  // ==========================================
  // DTO → Domain Aggregate (CREATE)
  // ==========================================

  static toAggregate(dto: CreateMenuAggregateDto): MenuAggregate {
    const slug = dto.slug || this.generateSlug(dto.title);

    return {
      title: dto.title,
      slug,
      isActive: dto.isActive ?? true,
      items: dto.items?.map<MenuItem>((item) => ({
        parentId: item.parentId ?? null,
        isActive: item.isActive ?? true, // ✅ Added
        sortOrder: item.sortOrder ?? 0,
        type: item.type,
        url: item.type === 'custom' ? item.url : null,
        target: item.target ?? '_self',
        referenceId: item.type !== 'custom' ? item.referenceId : null,
        translations: item.translations.map<MenuItemTranslation>((t) => ({
          languageId: t.languageId,
          label: t.label,
          slug: t.slug,
        })),
      })),
    };
  }

  // ==========================================
  // DTO → Domain Aggregate (UPDATE)
  // ==========================================

  static toAggregateForUpdate(dto: UpdateMenuAggregateDto, existing: MenuAggregate): MenuAggregate {
    return {
      ...existing,

      title: dto.title ?? existing.title,
      slug: dto.slug ?? existing.slug,
      isActive: dto.isActive ?? existing.isActive,

      items: dto.items ? this.mergeItems(existing.items ?? [], dto.items) : existing.items,
    };
  }

  // ==========================================
  // Domain Aggregate → Response DTO
  // ==========================================

  static toResponse(aggregate: MenuAggregate): MenuAggregateResponseDto {
    return {
      id: aggregate.id!,
      title: aggregate.title,
      slug: aggregate.slug,
      isActive: aggregate.isActive,
      createdAt: aggregate.createdAt!,
      updatedAt: aggregate.updatedAt!,
      items: aggregate.items?.map((item) => this.toItemResponse(item)),
    };
  }

  static toItemResponse(item: MenuItem): MenuItemResponseDto {
    return {
      id: item.id!,
      menuId: item.menuId!,
      isActive: item.isActive ?? true, // ✅ Added default
      parentId: item.parentId ?? null,
      order: item.sortOrder,
      type: item.type,
      url: item.url ?? null,
      target: item.target,
      referenceId: item.referenceId ?? null,
      createdAt: item.createdAt!,
      updatedAt: item.updatedAt!,
      translations: item.translations.map((t) => ({
        id: t.id!,
        menuItemId: item.id!,
        languageId: t.languageId,
        label: t.label,
        slug: t.slug,
      })),
      children: item.children?.map((child) => this.toItemResponse(child)),
    };
  }

  // ==========================================
  // Domain Aggregate → List Item DTO
  // ==========================================

  static toListItem(aggregate: MenuAggregate): MenuListItemDto {
    return {
      id: aggregate.id!,
      title: aggregate.title,
      slug: aggregate.slug,
      isActive: aggregate.isActive,
      itemCount: this.countItems(aggregate.items || []),
      createdAt: aggregate.createdAt!,
      updatedAt: aggregate.updatedAt!,
    };
  }

  static toItemListDto(item: MenuItem, languageId: number): MenuItemListDto {
    const translation =
      item.translations.find((t) => t.languageId === languageId) ?? item.translations[0];

    return {
      id: item.id!,
      menuId: item.menuId!,
      parentId: item.parentId ?? null,
      isActive: item.isActive ?? true, // ✅ Added default
      sortOrder: item.sortOrder,
      type: item.type,
      url: item.url ?? null,
      target: item.target,
      referenceId: item.referenceId ?? null,
      translation: {
        id: translation?.id ?? 0,
        languageId: translation?.languageId ?? languageId,
        label: translation?.label ?? '',
        slug: translation?.slug ?? '',
      },
      children: item.children?.map((child) => this.toItemListDto(child, languageId)),
    };
  }

  // ==========================================
  // Bulk conversion for list
  // ==========================================

  static toListItems(aggregates: MenuAggregate[]): MenuListItemDto[] {
    return aggregates.map((aggregate) => this.toListItem(aggregate));
  }

  // ==========================================
  // Helpers
  // ==========================================

  private static mergeItems(
    existingItems: MenuItem[],
    incomingItems: UpdateMenuItemDto[],
  ): MenuItem[] {
    return incomingItems.map((dto, index) => {
      const prev = dto.id ? existingItems.find((i) => i.id === dto.id) : undefined;

      return {
        id: prev?.id,
        menuId: prev?.menuId,

        parentId: dto.parentId ?? prev?.parentId ?? null,
        isActive: dto.isActive ?? prev?.isActive ?? true, // ✅ Added
        sortOrder: index,
        type: dto.type ?? prev?.type ?? 'custom',
        url: (dto.type ?? prev?.type) === 'custom' ? (dto.url ?? prev?.url ?? null) : null,
        target: dto.target ?? prev?.target ?? '_self',
        referenceId:
          (dto.type ?? prev?.type) !== 'custom'
            ? (dto.referenceId ?? prev?.referenceId ?? null)
            : null,

        translations: this.mergeTranslations(prev?.translations ?? [], dto.translations ?? []),
      };
    });
  }

  private static mergeTranslations(
    existing: MenuItemTranslation[],
    incoming: UpdateMenuItemTranslationDto[],
  ): MenuItemTranslation[] {
    return incoming.map((dto) => {
      const prev = dto.id
        ? existing.find((t) => t.id === dto.id)
        : existing.find((t) => t.languageId === dto.languageId); // ✅ Also match by languageId

      return {
        id: prev?.id,
        menuItemId: prev?.menuItemId,
        languageId: dto.languageId,
        label: dto.label,
        slug: dto.slug,
      };
    });
  }

  private static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private static countItems(items: MenuItem[]): number {
    let count = items.length;
    for (const item of items) {
      if (item.children?.length) {
        count += this.countItems(item.children);
      }
    }
    return count;
  }
}
