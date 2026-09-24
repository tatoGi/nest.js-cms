export const PostsPermissions = {
  CREATE_POSTS: 'posts.create',
  UPDATE_POSTS: 'posts.update',
  DELETE_POSTS: 'posts.delete',
  PUBLISH_POSTS: 'posts.publish',
  VIEW_POSTS: 'posts.view',
  VIEW_PUBLISHED_POSTS: 'posts.view_published',
} as const;

export type PostsPermission = (typeof PostsPermissions)[keyof typeof PostsPermissions];

export const PostsPermissionGroups = {
  ADMIN: [
    PostsPermissions.CREATE_POSTS,
    PostsPermissions.UPDATE_POSTS,
    PostsPermissions.DELETE_POSTS,
    PostsPermissions.PUBLISH_POSTS,
    PostsPermissions.VIEW_POSTS,
  ],
  EDITOR: [
    PostsPermissions.CREATE_POSTS,
    PostsPermissions.UPDATE_POSTS,
    PostsPermissions.PUBLISH_POSTS,
    PostsPermissions.VIEW_POSTS,
  ],
} as const;

export function isValidPostsPermission(permission: string): permission is PostsPermission {
  return Object.values(PostsPermissions).includes(permission as PostsPermission);
}

export function getAllPostsPermissions(): PostsPermission[] {
  return Object.values(PostsPermissions);
}
