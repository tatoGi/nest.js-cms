export class NotificationResponseDto {
  id!: number;
  type!: string;
  title!: string;
  message!: string;
  link?: string | null;
  actorId?: number | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  actorIsOnline?: boolean | null;
  createdAt!: Date;
  read!: boolean;
}

export class NotificationsListDto {
  items!: NotificationResponseDto[];
  unreadCount!: number;
  nextCursor!: number | null;
  hasMore!: boolean;
}
