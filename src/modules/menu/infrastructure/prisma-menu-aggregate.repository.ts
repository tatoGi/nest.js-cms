// src/modules/menus/infrastructure/prisma-menu-aggregate.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  MenuAggregate,
  MenuItem,
  MenuFilters,
  PaginationOptions,
  PaginatedResult,
  IMenuAggregateRepository,
  ReorderItemData,
} from '../domain';

@Injectable()
export class PrismaMenuAggregateRepository implements IMenuAggregateRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private buildWhere(filters?: MenuFilters): Prisma.MenuWhereInput {
    if (!filters) return {};

    const where: Prisma.MenuWhereInput = {};

    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.slug !== undefined) where.slug = filters.slug;

    if (filters.searchTerm) {
      where.OR = [
        { title: { contains: filters.searchTerm, mode: 'insensitive' } },
        { slug: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): Prisma.MenuOrderByWithRelationInput[] {
    if (!pagination?.sortBy) {
      return [{ title: 'asc' }, { id: 'asc' }];
    }

    const order = pagination.sortOrder || 'asc';
    return [{ [pagination.sortBy]: order }];
  }

  private mapToAggregate(menu: any): MenuAggregate {
    return {
      id: menu.id,
      title: menu.title,
      slug: menu.slug,
      isActive: menu.isActive,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      items: menu.items?.map((item: any) => this.mapToMenuItem(item)),
    };
  }
  private getFullInclude() {
    return {
      items: {
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          translations: true,
          children: {
            orderBy: { sortOrder: 'asc' as const },
            include: {
              translations: true,
              children: {
                orderBy: { sortOrder: 'asc' as const },
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      },
    };
  }

  // In prisma-menu-aggregate.repository.ts
  // Update the mapToMenuItem method to include isActive:

  private mapToMenuItem(item: any): MenuItem {
    return {
      id: item.id,
      menuId: item.menuId,
      parentId: item.parentId,
      isActive: item.isActive ?? true, // ✅ Add this
      sortOrder: item.sortOrder,
      type: item.type as 'custom' | 'page' | 'post',
      url: item.url,
      target: item.target as '_self' | '_blank',
      referenceId: item.referenceId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      translations:
        item.translations?.map((t: any) => ({
          id: t.id,
          menuItemId: t.menuItemId,
          languageId: t.languageId,
          label: t.label,
          slug: t.slug,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })) ?? [],
      children: item.children?.map((child: any) => this.mapToMenuItem(child)),
    };
  }

  // Also update saveAggregate to handle isActive:

  async saveAggregate(menu: MenuAggregate): Promise<MenuAggregate> {
    return this.prisma.$transaction(async (tx) => {
      if (!menu.id) {
        throw new Error('Menu ID is required for aggregate update');
      }

      // 1️⃣ Update menu root
      await tx.menu.update({
        where: { id: menu.id },
        data: {
          title: menu.title,
          slug: menu.slug,
          isActive: menu.isActive,
        },
      });

      const incomingItemIds =
        menu.items?.map((i) => i.id).filter((id): id is number => id !== undefined) ?? [];

      // 2️⃣ Delete removed items
      await tx.menuItem.deleteMany({
        where: {
          menuId: menu.id,
          id: { notIn: incomingItemIds },
        },
      });

      // 3️⃣ Upsert items
      for (const item of menu.items ?? []) {
        const savedItem = item.id
          ? await tx.menuItem.update({
              where: { id: item.id },
              data: {
                parentId: item.parentId ?? null,
                isActive: item.isActive ?? true, // ✅ Add this
                sortOrder: item.sortOrder,
                type: item.type,
                url: item.url,
                target: item.target,
                referenceId: item.referenceId,
              },
            })
          : await tx.menuItem.create({
              data: {
                menuId: menu.id,
                parentId: item.parentId ?? null,
                isActive: item.isActive ?? true, // ✅ Add this
                sortOrder: item.sortOrder,
                type: item.type,
                url: item.url,
                target: item.target,
                referenceId: item.referenceId,
              },
            });

        // 4️⃣ Sync translations
        const incomingTranslationIds = item.translations
          .map((t) => t.id)
          .filter((id): id is number => id !== undefined);

        await tx.menuItemTranslation.deleteMany({
          where: {
            menuItemId: savedItem.id,
            id: { notIn: incomingTranslationIds },
          },
        });

        for (const t of item.translations) {
          await tx.menuItemTranslation.upsert({
            where: {
              menuItemId_languageId: {
                menuItemId: savedItem.id,
                languageId: t.languageId,
              },
            },
            create: {
              menuItemId: savedItem.id,
              languageId: t.languageId,
              label: t.label,
              slug: t.slug,
            },
            update: {
              label: t.label,
              slug: t.slug,
            },
          });
        }
      }

      // 5️⃣ Return full aggregate
      return this.findByIdInTransaction(tx, menu.id) as Promise<MenuAggregate>;
    });
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  async findById(id: number): Promise<MenuAggregate | null> {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!menu) return null;

    return this.mapToAggregate(menu);
  }

  async findBySlug(slug: string): Promise<MenuAggregate | null> {
    const menu = await this.prisma.menu.findUnique({
      where: { slug },
      include: this.getFullInclude(),
    });

    if (!menu) return null;

    return this.mapToAggregate(menu);
  }

  async findAll(filters?: MenuFilters, pagination?: PaginationOptions): Promise<MenuAggregate[]> {
    const menus = await this.prisma.menu.findMany({
      where: this.buildWhere(filters),
      include: this.getFullInclude(),
      orderBy: this.buildOrderBy(pagination),
      skip:
        pagination?.page && pagination?.limit
          ? (pagination.page - 1) * pagination.limit
          : undefined,
      take: pagination?.limit,
    });

    return menus.map((menu) => this.mapToAggregate(menu));
  }

  async findPaginated(
    filters?: MenuFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<MenuAggregate>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const [menus, total] = await Promise.all([
      this.prisma.menu.findMany({
        where: this.buildWhere(filters),
        include: this.getFullInclude(),
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.menu.count({ where: this.buildWhere(filters) }),
    ]);

    return {
      data: menus.map((menu) => this.mapToAggregate(menu)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  async create(menu: MenuAggregate): Promise<MenuAggregate> {
    return this.prisma.$transaction(async (tx) => {
      // Create the menu
      const createdMenu = await tx.menu.create({
        data: {
          title: menu.title,
          slug: menu.slug,
          isActive: menu.isActive ?? true,
        },
      });

      // Create items if provided
      if (menu.items?.length) {
        for (const item of menu.items) {
          await this.createMenuItemInTransaction(tx, createdMenu.id, item);
        }
      }

      // Return the full aggregate
      return this.findByIdInTransaction(tx, createdMenu.id) as Promise<MenuAggregate>;
    });
  }

  async update(id: number, menu: Partial<MenuAggregate>): Promise<MenuAggregate> {
    await this.prisma.menu.update({
      where: { id },
      data: {
        ...(menu.title !== undefined && { title: menu.title }),
        ...(menu.slug !== undefined && { slug: menu.slug }),
        ...(menu.isActive !== undefined && { isActive: menu.isActive }),
      },
    });

    return this.findById(id) as Promise<MenuAggregate>;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.menu.delete({ where: { id } });
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  async exists(id: number): Promise<boolean> {
    const count = await this.prisma.menu.count({ where: { id } });
    return count > 0;
  }

  async isSlugUnique(slug: string, excludeId?: number): Promise<boolean> {
    const existing = await this.prisma.menu.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !existing;
  }

  // ==========================================
  // MENU ITEM OPERATIONS
  // ==========================================

  async findMenuItems(menuId: number, nested = true): Promise<MenuItem[]> {
    if (nested) {
      const items = await this.prisma.menuItem.findMany({
        where: { menuId, parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: {
          translations: true,
          children: {
            orderBy: { sortOrder: 'asc' },
            include: {
              translations: true,
              children: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      });

      return items.map((item) => this.mapToMenuItem(item));
    }

    const items = await this.prisma.menuItem.findMany({
      where: { menuId },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: true,
      },
    });

    return items.map((item) => this.mapToMenuItem(item));
  }

  async findMenuItemById(id: number): Promise<MenuItem | null> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: {
        translations: true,
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
          },
        },
      },
    });

    if (!item) return null;

    return this.mapToMenuItem(item);
  }

  async createMenuItem(menuId: number, item: MenuItem): Promise<MenuItem> {
    return this.prisma.$transaction(async (tx) => {
      return this.createMenuItemInTransaction(tx, menuId, item);
    });
  }

  async updateMenuItem(id: number, item: Partial<MenuItem>): Promise<MenuItem> {
    return this.prisma.$transaction(async (tx) => {
      // Update main item
      const updateData: any = {};

      if (item.parentId !== undefined) updateData.parentId = item.parentId;
      if (item.sortOrder !== undefined) updateData.order = item.sortOrder;
      if (item.type !== undefined) updateData.type = item.type;
      if (item.url !== undefined) updateData.url = item.url;
      if (item.target !== undefined) updateData.target = item.target;
      if (item.referenceId !== undefined) updateData.referenceId = item.referenceId;

      await tx.menuItem.update({
        where: { id },
        data: updateData,
      });

      // Update translations if provided
      if (item.translations?.length) {
        for (const t of item.translations) {
          await tx.menuItemTranslation.upsert({
            where: {
              menuItemId_languageId: {
                menuItemId: id,
                languageId: t.languageId,
              },
            },
            create: {
              menuItemId: id,
              languageId: t.languageId,
              label: t.label,
              slug: t.slug,
            },
            update: {
              label: t.label,
              slug: t.slug,
            },
          });
        }
      }

      // Return updated item
      const updated = await tx.menuItem.findUnique({
        where: { id },
        include: {
          translations: true,
          children: {
            orderBy: { sortOrder: 'asc' },
            include: {
              translations: true,
            },
          },
        },
      });

      return this.mapToMenuItem(updated);
    });
  }

  async deleteMenuItem(id: number): Promise<void> {
    await this.prisma.menuItem.delete({ where: { id } });
  }

  // menuId is part of the repository contract but unused here — item ids are
  // globally unique, so the update targets them directly.
  async reorderMenuItems(_menuId: number, items: ReorderItemData[]): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.menuItem.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            parentId: item.parentId ?? null,
          },
        }),
      ),
    );
  }

  async getMaxOrder(menuId: number, parentId?: number | null): Promise<number> {
    const result = await this.prisma.menuItem.aggregate({
      where: {
        menuId,
        parentId: parentId ?? null,
      },
      _max: {
        sortOrder: true,
      },
    });
    return result._max.sortOrder ?? -1;
  }

  // ==========================================
  // PRIVATE TRANSACTION HELPERS
  // ==========================================

  private async createMenuItemInTransaction(
    tx: Prisma.TransactionClient,
    menuId: number,
    item: MenuItem,
    parentId?: number | null,
  ): Promise<MenuItem> {
    const createdItem = await tx.menuItem.create({
      data: {
        menuId,
        parentId: parentId ?? item.parentId ?? null,
        sortOrder: item.sortOrder,
        type: item.type,
        url: item.url,
        target: item.target ?? '_self',
        referenceId: item.referenceId,
      },
    });

    // Create translations
    if (item.translations?.length) {
      await tx.menuItemTranslation.createMany({
        data: item.translations.map((t) => ({
          menuItemId: createdItem.id,
          languageId: t.languageId,
          label: t.label,
          slug: t.slug,
        })),
      });
    }

    // Create children recursively
    if (item.children?.length) {
      for (const child of item.children) {
        await this.createMenuItemInTransaction(tx, menuId, child, createdItem.id);
      }
    }

    // Return created item with translations
    const result = await tx.menuItem.findUnique({
      where: { id: createdItem.id },
      include: {
        translations: true,
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
          },
        },
      },
    });

    return this.mapToMenuItem(result);
  }

  private async findByIdInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<MenuAggregate | null> {
    const menu = await tx.menu.findUnique({
      where: { id },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
            children: {
              orderBy: { sortOrder: 'asc' },
              include: {
                translations: true,
                children: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    translations: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!menu) return null;

    return this.mapToAggregate(menu);
  }
}
