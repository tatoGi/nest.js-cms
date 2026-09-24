export const RolesPermissions = {
  VIEW_ROLES: 'roles.view',
  CREATE_ROLES: 'roles.create',
  UPDATE_ROLES: 'roles.update',
  DELETE_ROLES: 'roles.delete',
} as const;

export const PermissionsPermissions = {
  VIEW_PERMISSIONS: 'permissions.view',
  CREATE_PERMISSIONS: 'permissions.create',
  UPDATE_PERMISSIONS: 'permissions.update',
  DELETE_PERMISSIONS: 'permissions.delete',
} as const;

export type RolesPermission = (typeof RolesPermissions)[keyof typeof RolesPermissions];
