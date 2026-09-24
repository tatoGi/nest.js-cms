export const SettingsPermissions = {
  VIEW_SETTINGS: 'settings.view',
  CREATE_SETTING: 'settings.create',
  UPDATE_SETTING: 'settings.update',
  DELETE_SETTING: 'settings.delete',
} as const;

export type SettingsPermission = (typeof SettingsPermissions)[keyof typeof SettingsPermissions];
