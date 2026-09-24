import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificationResponseDto, NotificationsListDto } from '../dto/notification.dto';

export interface CreateNotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string;
  actorId?: number;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
      },
    });
  }

  async findAll(
    userId: number,
    params: { limit?: number; cursor?: number } = {},
  ): Promise<NotificationsListDto> {
    const limit = params.limit ?? 20;

    const [notifications, state] = await Promise.all([
      this.prisma.notification.findMany({
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              lastSeen: true,
              avatarMedia: { select: { id: true, url: true } },
            },
          },
        },
      }),
      this.prisma.userNotificationState.findUnique({
        where: { userId },
      }),
    ]);

    const hasMore = notifications.length > limit;
    const page = hasMore ? notifications.slice(0, limit) : notifications;

    const lastReadAt = state?.lastReadAt ?? new Date(0);

    const items: NotificationResponseDto[] = page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      actorId: n.actorId,
      actorName: n.actor?.displayName ?? null,
      actorAvatarUrl: n.actor?.avatarMedia?.url ?? null,
      actorIsOnline: n.actor?.lastSeen
        ? Date.now() - n.actor.lastSeen.getTime() < 3 * 60 * 1000
        : null,
      createdAt: n.createdAt,
      read: n.createdAt <= lastReadAt,
    }));

    const unreadCount = items.filter((n) => !n.read).length;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { items, unreadCount, nextCursor, hasMore };
  }

  async markAllRead(userId: number): Promise<void> {
    await this.prisma.userNotificationState.upsert({
      where: { userId },
      update: { lastReadAt: new Date() },
      create: { userId, lastReadAt: new Date() },
    });
  }

  async getUnreadCount(userId: number): Promise<number> {
    const state = await this.prisma.userNotificationState.findUnique({
      where: { userId },
    });

    const lastReadAt = state?.lastReadAt ?? new Date(0);

    return this.prisma.notification.count({
      where: { createdAt: { gt: lastReadAt } },
    });
  }
}
