export const MenusPermissions = {
  CREATE_MENUS: 'menus.create',
  UPDATE_MENUS: 'menus.update',
  DELETE_MENUS: 'menus.delete',

  CREATE_MENU_ITEMS: 'menus.items.create',
  UPDATE_MENU_ITEMS: 'menus.items.update',
  DELETE_MENU_ITEMS: 'menus.items.delete',
  REORDER_MENU_ITEMS: 'menus.items.reorder',

  VIEW_MENUS: 'menus.view',
  VIEW_ACTIVE_MENUS: 'menus.view-active',
} as const;

export type MenusPermission = (typeof MenusPermissions)[keyof typeof MenusPermissions];

export const MenusPermissionGroups = {
  ADMIN: [
    MenusPermissions.CREATE_MENUS,
    MenusPermissions.UPDATE_MENUS,
    MenusPermissions.DELETE_MENUS,
    MenusPermissions.CREATE_MENU_ITEMS,
    MenusPermissions.UPDATE_MENU_ITEMS,
    MenusPermissions.DELETE_MENU_ITEMS,
    MenusPermissions.REORDER_MENU_ITEMS,
    MenusPermissions.VIEW_MENUS,
  ],
  EDITOR: [MenusPermissions.VIEW_MENUS],
  VIEWER: [MenusPermissions.VIEW_ACTIVE_MENUS],
} as const;

export function isValidMenusPermission(permission: string): boolean {
  return Object.values(MenusPermissions).includes(permission as any);
}

export function getAllMenusPermissions(): string[] {
  return Object.values(MenusPermissions);
}
