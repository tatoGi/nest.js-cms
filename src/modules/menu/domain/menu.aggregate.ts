// src/modules/menus/domain/menu.aggregate.ts

export interface Menu {
  id: number;
  title: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItemTranslation {
  id?: number;
  menuItemId?: number;
  languageId: number;
  label: string;
  slug: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MenuItem {
  id?: number;
  menuId?: number;
  parentId?: number | null;
  isActive?: boolean;
  sortOrder: number;
  type: 'custom' | 'page' | 'post';
  url?: string | null;
  target: '_self' | '_blank';
  referenceId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  translations: MenuItemTranslation[];
  children?: MenuItem[];
}

export interface MenuAggregate {
  id?: number;
  title: string;
  slug: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  items?: MenuItem[];
}
