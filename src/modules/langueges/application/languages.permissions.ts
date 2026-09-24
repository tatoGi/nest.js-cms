export const LanguagesPermissions = {
  CREATE_LANGUAGES: 'languages.create',
  UPDATE_LANGUAGES: 'languages.update',
  DELETE_LANGUAGES: 'languages.delete',
  TOGGLE_LANGUAGES: 'languages.toggle',
  VIEW_LANGUAGES: 'languages.view',
  VIEW_ENABLED_LANGUAGES: 'languages.view-enabled',
} as const;

export type LanguagesPermission = (typeof LanguagesPermissions)[keyof typeof LanguagesPermissions];

export const LanguagesPermissionGroups = {
  ADMIN: [
    LanguagesPermissions.CREATE_LANGUAGES,
    LanguagesPermissions.UPDATE_LANGUAGES,
    LanguagesPermissions.DELETE_LANGUAGES,
    LanguagesPermissions.TOGGLE_LANGUAGES,
    LanguagesPermissions.VIEW_LANGUAGES,
  ],
  EDITOR: [LanguagesPermissions.VIEW_LANGUAGES],
} as const;

export function isValidLanguagesPermission(permission: string): boolean {
  return Object.values(LanguagesPermissions).includes(permission as any);
}

export function getAllLanguagesPermissions(): string[] {
  return Object.values(LanguagesPermissions);
}
