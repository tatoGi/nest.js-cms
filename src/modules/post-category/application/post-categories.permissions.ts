export const PostCategoryPermissions = {
  VIEW_POST_CATEGORY: 'post-categories.view',
  CREATE_POST_CATEGORY: 'post-categories.create',
  UPDATE_POST_CATEGORY: 'post-categories.update',
  DELETE_POST_CATEGORY: 'post-categories.delete',
} as const;

export type PostCategoryPermission =
  (typeof PostCategoryPermissions)[keyof typeof PostCategoryPermissions];

export function isValidPostCategoryPermission(permission: string): boolean {
  return Object.values(PostCategoryPermissions).includes(permission as any);
}

export function getAllPostCategoryPermissions(): string[] {
  return Object.values(PostCategoryPermissions);
}
