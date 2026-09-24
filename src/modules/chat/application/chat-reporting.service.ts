import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ChatService, ChatCloseReason } from './chat.service';
import { SESSION_INCLUDE } from './chat-select.constants';

// Read-only dashboard/reporting aggregation — kept separate from ChatService
// (session lifecycle) since none of these queries mutate anything or share
// state with it, only the same underlying tables. Depends on ChatService
// only for isOperatorSupervisor (see getOperatorStats) — the same
// permission-based check pickAvailableOperator/drainQueue/getOperators use,
// rather than trusting a role slug to exclude supervisors.
@Injectable()
export class ChatReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  private resolveDateRange(from?: Date, to?: Date): { from: Date; to: Date } {
    const resolvedTo = to ?? new Date();
    const resolvedFrom = from ?? new Date(resolvedTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: resolvedFrom, to: resolvedTo };
  }

  async getQueuedSessionsSummary() {
    const where = { status: 'open' as const, operatorId: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.chatSession.count({ where }),
    ]);
    return { items, total };
  }

  // Per-operator: chats handled, avg duration, avg first-response time (only
  // over sessions with at least one operator message — see "completed vs
  // abandoned" below), avg visitor rating. All computed from data already
  // captured — no new schema field. See chat-reporting-plan.md.
  async getOperatorStats(from?: Date, to?: Date) {
    const range = this.resolveDateRange(from, to);
    const sessions = await this.prisma.chatSession.findMany({
      where: { status: 'closed', closedAt: { gte: range.from, lte: range.to } },
      include: {
        operator: { select: { id: true, displayName: true } },
        // authorId non-null, not just role: 'operator' — greeting/queue_wait/
        // inactivity_warning/inactivity_close are all saved with role
        // 'operator' but no authorId (nobody human sent them), so role
        // alone would count an untouched, never-replied-to session as
        // having a "first response".
        messages: {
          where: { role: 'operator', authorId: { not: null } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    interface Accumulator {
      operatorId: number;
      operatorName: string;
      chatsHandled: number;
      totalDurationMs: number;
      totalFirstResponseMs: number;
      firstResponseSamples: number;
      totalRating: number;
      ratingSamples: number;
    }

    const byOperator = new Map<number, Accumulator>();

    for (const session of sessions) {
      if (!session.operatorId || !session.operator) continue; // no operator to attribute to

      const entry =
        byOperator.get(session.operatorId) ??
        ({
          operatorId: session.operatorId,
          operatorName: session.operator.displayName,
          chatsHandled: 0,
          totalDurationMs: 0,
          totalFirstResponseMs: 0,
          firstResponseSamples: 0,
          totalRating: 0,
          ratingSamples: 0,
        } satisfies Accumulator);

      entry.chatsHandled++;
      if (session.closedAt) {
        entry.totalDurationMs += session.closedAt.getTime() - session.startedAt.getTime();
      }

      const firstOperatorMessage = session.messages[0];
      if (firstOperatorMessage) {
        entry.totalFirstResponseMs +=
          firstOperatorMessage.createdAt.getTime() - session.startedAt.getTime();
        entry.firstResponseSamples++;
      }

      if (session.visitorRating !== null) {
        entry.totalRating += session.visitorRating;
        entry.ratingSamples++;
      }

      byOperator.set(session.operatorId, entry);
    }

    // A supervisor who personally closed some sessions (e.g. covering during
    // testing) shouldn't appear in operator performance stats — same
    // exclusion as getOperators, checked once per distinct operator here
    // rather than per session.
    const entries = Array.from(byOperator.values());
    const supervisorFlags = await Promise.all(
      entries.map((entry) => this.chatService.isOperatorSupervisor(entry.operatorId)),
    );

    return entries
      .filter((_, i) => !supervisorFlags[i])
      .map((entry) => ({
        operatorId: entry.operatorId,
        operatorName: entry.operatorName,
        chatsHandled: entry.chatsHandled,
        avgDurationMs:
          entry.chatsHandled > 0 ? Math.round(entry.totalDurationMs / entry.chatsHandled) : null,
        avgFirstResponseMs:
          entry.firstResponseSamples > 0
            ? Math.round(entry.totalFirstResponseMs / entry.firstResponseSamples)
            : null,
        avgRating: entry.ratingSamples > 0 ? entry.totalRating / entry.ratingSamples : null,
      }));
  }

  // Completed = at least one operator ChatMessage on the session (a human
  // actually engaged). Abandoned = zero. See chat-reporting-plan.md — this is
  // a stated business-rule assumption, not derived unambiguously from the
  // existing schema.
  async getOutcomeStats(from?: Date, to?: Date) {
    const range = this.resolveDateRange(from, to);
    const sessions = await this.prisma.chatSession.findMany({
      where: { status: 'closed', closedAt: { gte: range.from, lte: range.to } },
      select: {
        id: true,
        resolutionTag: true,
        // authorId non-null — role: 'operator' alone also matches automatic
        // messages (greeting/queue_wait/inactivity_warning/inactivity_close),
        // which would otherwise count every session that ever got one of
        // those as "completed" even if no human ever replied.
        messages: {
          where: { role: 'operator', authorId: { not: null } },
          take: 1,
          select: { id: true },
        },
      },
    });

    let completed = 0;
    let abandoned = 0;
    // Fixed 3-key breakdown by close reason — legacy resolutionTag values
    // predating the enum (e.g. "Resolved", "Spam") don't match any key and
    // are simply not counted here, same as elsewhere in this refactor (see
    // getUnspecifiedCloseReasonCount on the CMS side, which buckets
    // everything not tracked here as "Unspecified"). Sessions closed via the
    // "leave contact info" form count under CLIENT_CLOSED like any other
    // visitor-initiated close — see ChatSession.contactInfoLeft for that
    // distinction instead.
    type TrackedCloseReason =
      | ChatCloseReason.CLIENT_CLOSED
      | ChatCloseReason.INACTIVITY_TIMEOUT
      | ChatCloseReason.OPERATOR_CLOSED;
    const byCloseReason: Record<TrackedCloseReason, number> = {
      [ChatCloseReason.CLIENT_CLOSED]: 0,
      [ChatCloseReason.INACTIVITY_TIMEOUT]: 0,
      [ChatCloseReason.OPERATOR_CLOSED]: 0,
    };
    for (const session of sessions) {
      if (session.messages.length > 0) completed++;
      else abandoned++;

      if (session.resolutionTag && session.resolutionTag in byCloseReason) {
        byCloseReason[session.resolutionTag as TrackedCloseReason]++;
      }
    }

    return { completed, abandoned, total: sessions.length, byCloseReason };
  }

  async getRegionProgramReport(from?: Date, to?: Date) {
    const range = this.resolveDateRange(from, to);
    const where = { status: 'closed' as const, closedAt: { gte: range.from, lte: range.to } };

    const [byRegion, byProgram] = await Promise.all([
      this.prisma.chatSession.groupBy({
        by: ['regionId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.chatSession.groupBy({
        by: ['programId'],
        where,
        _count: { _all: true },
      }),
    ]);

    const regionIds = byRegion.map((row) => row.regionId).filter((id): id is string => id !== null);
    const regions = regionIds.length
      ? await this.prisma.region.findMany({
          where: { id: { in: regionIds } },
          select: { id: true, name: true },
        })
      : [];
    const regionNameById = new Map(regions.map((r) => [r.id, r.name]));

    const programIds = byProgram
      .map((row) => row.programId)
      .filter((id): id is string => id !== null);
    const programs = programIds.length
      ? await this.prisma.program.findMany({
          where: { id: { in: programIds } },
          select: { id: true, name: true },
        })
      : [];
    const programNameById = new Map(programs.map((p) => [p.id, p.name]));

    return {
      byRegion: byRegion.map((row) => ({
        regionId: row.regionId,
        region: row.regionId ? (regionNameById.get(row.regionId) ?? 'Unknown') : 'Unspecified',
        count: row._count._all,
      })),
      byProgram: byProgram.map((row) => ({
        programId: row.programId,
        programName: row.programId
          ? (programNameById.get(row.programId) ?? 'Unknown')
          : 'Unspecified',
        count: row._count._all,
      })),
    };
  }

  // Today's snapshot for the live dashboard — reuses getOutcomeStats' same
  // completed/abandoned definition, scoped to the current day.
  async getDailyStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const outcome = await this.getOutcomeStats(startOfDay, now);

    const ratedSessions = await this.prisma.chatSession.findMany({
      where: {
        status: 'closed',
        closedAt: { gte: startOfDay, lte: now },
        visitorRating: { not: null },
      },
      select: { visitorRating: true },
    });
    const avgRating = ratedSessions.length
      ? ratedSessions.reduce((sum, s) => sum + (s.visitorRating ?? 0), 0) / ratedSessions.length
      : null;

    return { ...outcome, avgRating };
  }
}
