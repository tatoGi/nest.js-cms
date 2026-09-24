export const UsersPermissions = {
  VIEW_USERS: 'users.view',
  CREATE_USERS: 'users.create',
  UPDATE_USERS: 'users.update',
  DELETE_USERS: 'users.delete',
  TOGGLE_USERS: 'users.toggle',
} as const;

export type UsersPermission = (typeof UsersPermissions)[keyof typeof UsersPermissions];
