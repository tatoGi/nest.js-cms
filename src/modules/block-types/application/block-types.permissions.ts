export const BlockTypesPermissions = {
  CREATE_BLOCK_TYPE: 'block-types.create',
  UPDATE_BLOCK_TYPE: 'block-types.update',
  DELETE_BLOCK_TYPE: 'block-types.delete',
  TOGGLE_BLOCK_TYPE: 'block-types.toggle',
  VIEW_BLOCK_TYPES: 'block-types.view',
  VIEW_ENABLED_BLOCK_TYPES: 'block-types.view-enabled',
} as const;

export type BlockTypesPermission =
  (typeof BlockTypesPermissions)[keyof typeof BlockTypesPermissions];

export const BlockTypesPermissionGroups = {
  ADMIN: [
    BlockTypesPermissions.CREATE_BLOCK_TYPE,
    BlockTypesPermissions.UPDATE_BLOCK_TYPE,
    BlockTypesPermissions.DELETE_BLOCK_TYPE,
    BlockTypesPermissions.TOGGLE_BLOCK_TYPE,
    BlockTypesPermissions.VIEW_BLOCK_TYPES,
  ],
  EDITOR: [BlockTypesPermissions.VIEW_BLOCK_TYPES],
} as const;

export function isValidBlockTypesPermission(permission: string): boolean {
  return Object.values(BlockTypesPermissions).includes(permission as any);
}

export function getAllBlockTypesPermissions(): string[] {
  return Object.values(BlockTypesPermissions);
}
