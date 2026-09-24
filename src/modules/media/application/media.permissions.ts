export const MediaPermissions = {
  VIEW_MEDIA: 'media.view',
  UPLOAD_MEDIA: 'media.upload',
  UPDATE_MEDIA: 'media.update',
  DELETE_MEDIA: 'media.delete',
} as const;

export type MediaPermission = (typeof MediaPermissions)[keyof typeof MediaPermissions];
