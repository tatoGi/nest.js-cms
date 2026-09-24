export const PagesPermissions = {
  CREATE_PAGES: 'pages.create',
  UPDATE_PAGES: 'pages.update',
  DELETE_PAGES: 'pages.delete',
  PUBLISH_PAGES: 'pages.publish',
  VIEW_PAGES: 'pages.view',
  VIEW_PUBLISHED_PAGES: 'pages.view-published',
} as const;

export type PagesPermission = (typeof PagesPermissions)[keyof typeof PagesPermissions];

export const PagesPermissionGroups = {
  ADMIN: [
    PagesPermissions.CREATE_PAGES,
    PagesPermissions.UPDATE_PAGES,
    PagesPermissions.DELETE_PAGES,
    PagesPermissions.PUBLISH_PAGES,
    PagesPermissions.VIEW_PAGES,
  ],
  EDITOR: [
    PagesPermissions.CREATE_PAGES,
    PagesPermissions.UPDATE_PAGES,
    PagesPermissions.PUBLISH_PAGES,
    PagesPermissions.VIEW_PAGES,
  ],
} as const;

export function isValidPagesPermission(permission: string): boolean {
  return Object.values(PagesPermissions).includes(permission as any);
}

export function getAllPagesPermissions(): string[] {
  return Object.values(PagesPermissions);
}
