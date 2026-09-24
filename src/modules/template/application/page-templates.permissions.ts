export const PageTemplatesPermissions = {
  CREATE_PAGE_TEMPLATES: 'page-templates.create',
  UPDATE_PAGE_TEMPLATES: 'page-templates.update',
  DELETE_PAGE_TEMPLATES: 'page-templates.delete',
  VIEW_PAGE_TEMPLATES: 'page-templates.view',
  VIEW_PUBLIC_PAGE_TEMPLATES: 'page-templates.view-public',
} as const;

export type PageTemplatesPermission =
  (typeof PageTemplatesPermissions)[keyof typeof PageTemplatesPermissions];

export const PageTemplatesPermissionGroups = {
  ADMIN: [
    PageTemplatesPermissions.CREATE_PAGE_TEMPLATES,
    PageTemplatesPermissions.UPDATE_PAGE_TEMPLATES,
    PageTemplatesPermissions.DELETE_PAGE_TEMPLATES,
    PageTemplatesPermissions.VIEW_PAGE_TEMPLATES,
  ],
  EDITOR: [PageTemplatesPermissions.VIEW_PAGE_TEMPLATES],
} as const;

export function isValidPageTemplatesPermission(permission: string): boolean {
  return Object.values(PageTemplatesPermissions).includes(permission as any);
}

export function getAllPageTemplatesPermissions(): string[] {
  return Object.values(PageTemplatesPermissions);
}
