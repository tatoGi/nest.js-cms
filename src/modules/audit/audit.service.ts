import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PaginationOptions, PaginatedResult } from '@/common/pagination/pagination.type';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';

export interface AuditLogEntry {
  actorId?: number;
  action: string;
  targetType: string;
  targetId?: number;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ip?: string;
}

export interface AuditLogFilters {
  actorId?: number;
  action?: string;
  targetType?: string;
  targetId?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        before:
          entry.before !== undefined ? (entry.before as Prisma.InputJsonValue) : Prisma.JsonNull,
        after: entry.after !== undefined ? (entry.after as Prisma.InputJsonValue) : Prisma.JsonNull,
        ip: entry.ip ?? null,
      },
    });
  }

  async findPaginated(
    filters: AuditLogFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<any>> {
    const where: any = {};
    if (filters.actorId !== undefined) where.actorId = filters.actorId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.targetId !== undefined) where.targetId = filters.targetId;

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const result = await prismaPaginate(
      this.prisma.auditLog,
      {
        where,
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              email: true,
              lastSeen: true,
              avatarMedia: { select: { id: true, url: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      { page, limit, skip },
    );

    // Resolve target user credentials when targetType === 'user'
    const userTargetIds = result.data
      .filter((log: any) => log.targetType === 'user' && log.targetId)
      .map((log: any) => log.targetId as number);

    const uniqueIds = [...new Set(userTargetIds)];
    const targetUsers =
      uniqueIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: uniqueIds } },
            select: {
              id: true,
              displayName: true,
              email: true,
              lastSeen: true,
              avatarMedia: { select: { id: true, url: true } },
            },
          })
        : [];

    const userMap = new Map(targetUsers.map((u) => [u.id, u]));
    const isOnline = (lastSeen: Date | null) =>
      !!lastSeen && Date.now() - lastSeen.getTime() < 3 * 60 * 1000;

    const data = result.data.map((log: any) => {
      const actor = log.actor ? { ...log.actor, isOnline: isOnline(log.actor.lastSeen) } : null;

      const targetUser =
        log.targetType === 'user' && log.targetId ? (userMap.get(log.targetId) ?? null) : null;
      const target = targetUser ? { ...targetUser, isOnline: isOnline(targetUser.lastSeen) } : null;

      return { ...log, actor, target };
    });

    return { ...result, data };
  }
}
