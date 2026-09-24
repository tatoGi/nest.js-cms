import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  StartSessionDto,
  CloseSessionWithResolutionDto,
  UpdateSessionDetailsDto,
} from '../dto/chat.dto';
import { KNOWN_USER_SELECT, OPERATOR_SELECT, SESSION_INCLUDE } from './chat-select.constants';
import { resolveTbilisiRange } from './timezone.util';
import { sanitizeRichText, hasMarkup } from './rich-text.util';

// Fixed page size for the CMS's Chat History table — the client only sends
// `page`; the offset (`skip`) is always derived from it here.
const CHAT_HISTORY_PAGE_SIZE = 20;

// The complete, fixed set of close reasons — every session close is one of
// these three, always assigned by the system (never picked by an operator):
// the visitor ended it themselves (including via the "leave contact info"
// form — see ChatGateway.handleVisitorLeaveContactInfo, which tracks that
// separately via ChatSession.contactInfoLeft rather than a 4th reason here),
// the inactivity timer auto-closed it, or an operator closed it (regardless
// of why). TS-level enum only — the resolutionTag column stays a plain
// string so pre-existing legacy values (Resolved, Spam, etc., from before
// this became a fixed set) still work.
export enum ChatCloseReason {
  CLIENT_CLOSED = 'Client Ended Chat',
  INACTIVITY_TIMEOUT = 'Session Timed Out',
  OPERATOR_CLOSED = 'Closed by Operator',
}

// Session lifecycle, capacity/queue bookkeeping, and the singleton
// ChatConfig — the core domain every other chat service/gateway handler
// ultimately depends on. Programs/Regions/CannedResponses/reporting each
// have their own service now (see ProgramsService, RegionsService,
// CannedResponseService, ChatReportingService) since none of that shares
// state with session lifecycle, only the same Prisma client.
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async startSession(dto: StartSessionDto) {
    let knownUserId: number | undefined;
    if (dto.visitorEmail) {
      const match = await this.prisma.user.findUnique({
        where: { email: dto.visitorEmail.toLowerCase().trim() },
        select: { id: true },
      });
      if (match) knownUserId = match.id;
    }

    return this.prisma.chatSession.create({
      data: {
        visitorName: dto.visitorName,
        visitorEmail: dto.visitorEmail,
        visitorPhone: dto.visitorPhone,
        visitorLanguage: dto.visitorLanguage,
        visitorBrowser: dto.visitorBrowser,
        visitorIp: dto.visitorIp,
        visitorPage: dto.visitorPage,
        knownUserId,
        status: 'open',
      },
      include: {
        knownUser: { select: KNOWN_USER_SELECT },
        closedByOperator: { select: OPERATOR_SELECT },
      },
    });
  }

  // onlyAssigned excludes still-unassigned (waiting-queue) sessions — used by
  // the dashboard's "Active Chats" table, which must stay disjoint from its
  // separate "Waiting Queue" table (getQueuedSessionsSummary). The main
  // /chat/open inbox endpoint leaves this false, since operators there rely
  // on client-side Mine/All + operatorId filtering instead.
  async getOpenSessions(skip = 0, take = 20, onlyAssigned = false) {
    const where = {
      status: 'open' as const,
      ...(onlyAssigned ? { operatorId: { not: null } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { startedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatSession.count({ where }),
    ]);
    return { items, total };
  }

  async getClosedSessions(skip = 0, take = 20, operatorId?: number) {
    const where = {
      status: 'closed' as const,
      deletedAt: null,
      ...(operatorId ? { operatorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { closedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatSession.count({ where }),
    ]);
    return { items, total };
  }

  // Server-side filtered/paginated history for the CMS's Chat History table
  // — a separate, richer query from getClosedSessions above (which stays as
  // the simple "operator's own closed chats" inbox tab), since the filters
  // here (multiselect agent/language/resolution/rating + date range +
  // free-text search) don't apply to that lighter-weight use.
  // Shared by getChatHistory (paginated, for the table) and
  // streamChatHistoryExport (batched, for the xlsx download) — the filter
  // rules must stay identical between the two so "export" always matches
  // what's currently on screen.
  private buildChatHistoryWhere(params: {
    operatorIds?: number[];
    languages?: string[];
    resolutionTags?: string[];
    ratings?: number[];
    // Selecting both true+false means "either" (i.e. only sessions with a
    // recorded mail status at all, excluding the null default every other
    // resolutionTag carries) — not "no filter". See the CMS's
    // toChatHistoryParams for why this must stay an array, not a boolean.
    contactRequestEmailSent?: boolean[];
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return {
      status: 'closed' as const,
      deletedAt: null,
      ...(params.operatorIds?.length ? { operatorId: { in: params.operatorIds } } : {}),
      ...(params.languages?.length ? { visitorLanguage: { in: params.languages } } : {}),
      ...(params.resolutionTags?.length ? { resolutionTag: { in: params.resolutionTags } } : {}),
      ...(params.ratings?.length ? { visitorRating: { in: params.ratings } } : {}),
      // Boolean columns have no Prisma `in` filter (only two non-null
      // values exist) — a single selection filters to exactly that value,
      // both selected means "either" (i.e. `not: null`, excluding sessions
      // where this was never recorded at all).
      ...(params.contactRequestEmailSent?.length === 1
        ? { contactRequestEmailSent: params.contactRequestEmailSent[0] }
        : params.contactRequestEmailSent?.length === 2
          ? { contactRequestEmailSent: { not: null } }
          : {}),
      // Labeled "keyword" in the CMS, so it's expected to match more than
      // just visitor contact fields — closureSummary (the operator's own
      // closing comment, also an exported report column) and the assigned
      // operator's name are cheap, direct-field additions. Full message-body
      // search was deliberately left out of this round (would need a join
      // against the messages table and likely a dedicated index) — see
      // docs/plan.md.
      ...(params.search
        ? {
            OR: [
              { visitorName: { contains: params.search, mode: 'insensitive' as const } },
              { visitorPhone: { contains: params.search, mode: 'insensitive' as const } },
              { visitorEmail: { contains: params.search, mode: 'insensitive' as const } },
              { closureSummary: { contains: params.search, mode: 'insensitive' as const } },
              {
                operator: {
                  displayName: { contains: params.search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            // Both bounds are interpreted as Asia/Tbilisi wall-clock time via
            // resolveTbilisiRange, not raw new Date(...) — that used to parse
            // dateFrom as UTC midnight but dateTo as server-local time (two
            // different, business-timezone-blind interpretations of the same
            // kind of string), which both dropped valid sessions from the
            // range and produced the wrong exported hours.
            startedAt: resolveTbilisiRange(params.dateFrom, params.dateTo),
          }
        : {}),
    };
  }

  async getChatHistory(params: {
    page?: number;
    operatorIds?: number[];
    languages?: string[];
    resolutionTags?: string[];
    ratings?: number[];
    contactRequestEmailSent?: boolean[];
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const take = CHAT_HISTORY_PAGE_SIZE;
    const skip = ((params.page ?? 1) - 1) * take;
    const where = this.buildChatHistoryWhere(params);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { closedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatSession.count({ where }),
    ]);
    return { items, total };
  }

  // Yields fixed-size batches (id-cursor paginated, not skip/take — stays
  // O(batch) per page instead of degrading on a large offset) so the
  // exporter can stream rows to the xlsx writer without ever holding the
  // full result set in memory, no matter how many sessions match the filter.
  async *iterateChatHistoryForExport(
    params: {
      operatorIds?: number[];
      languages?: string[];
      resolutionTags?: string[];
      ratings?: number[];
      contactRequestEmailSent?: boolean[];
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    batchSize = 500,
  ) {
    const where = this.buildChatHistoryWhere(params);
    let cursor: string | undefined;
    for (;;) {
      const items = await this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { id: 'desc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (items.length === 0) return;
      yield items;
      if (items.length < batchSize) return;
      cursor = items[items.length - 1].id;
    }
  }

  async getVisitorHistory(email: string, excludeSessionId?: string) {
    return this.prisma.chatSession.findMany({
      where: {
        visitorEmail: email,
        status: 'closed',
        deletedAt: null,
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      include: {
        operator: { select: OPERATOR_SELECT },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { closedAt: 'desc' },
      take: 3,
    });
  }

  // ── Chat session trash (soft delete) ─────────────────────────────
  // Only closed sessions may be trashed — an open/active session must be
  // closed first, same reasoning as why Posts/Pages don't let you trash a
  // record mid-edit.

  async getTrashedSessions(skip = 0, take = 20) {
    const where = { deletedAt: { not: null } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { deletedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatSession.count({ where }),
    ]);
    return { items, total };
  }

  async trashSession(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');
    if (session.status !== 'closed') {
      throw new BadRequestException('Only closed sessions can be moved to trash');
    }
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    });
  }

  // Bulk counterpart of trashSession — same "only closed sessions" rule,
  // but silently skips any open session in the batch rather than failing
  // the whole request (the CMS's Chat History table only ever lists closed
  // sessions anyway, so this is a defense-in-depth check, not expected to
  // actually filter anything in normal use).
  async bulkTrashSessions(sessionIds: string[]) {
    return this.prisma.chatSession.updateMany({
      where: { id: { in: sessionIds }, status: 'closed' },
      data: { deletedAt: new Date() },
    });
  }

  async restoreSession(sessionId: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { deletedAt: null },
    });
  }

  // Bulk counterpart of restoreSession — backs the Trash tab's multi-select
  // restore.
  async bulkRestoreSessions(sessionIds: string[]) {
    return this.prisma.chatSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { deletedAt: null },
    });
  }

  // Bulk counterpart of hardDeleteSession — backs the Trash tab's
  // multi-select permanent delete.
  async bulkHardDeleteSessions(sessionIds: string[]) {
    return this.prisma.chatSession.deleteMany({ where: { id: { in: sessionIds } } });
  }

  async hardDeleteSession(sessionId: string) {
    return this.prisma.chatSession.delete({ where: { id: sessionId } });
  }

  // includeInternal has no default — every call site must say explicitly
  // whether its audience may see operator-only internal notes. Visitor-
  // facing callers (visitor:rejoin) must always pass false; only
  // operator-authenticated callers (the REST history endpoint, now gated by
  // chat.view) may pass true. See .forge/decisions — this used to have no
  // filter at all, leaking internal notes straight to the visitor.
  async getSessionMessages(sessionId: string, includeInternal: boolean, skip = 0, take = 10) {
    const where = includeInternal ? { sessionId } : { sessionId, isInternal: false };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.chatMessage.count({ where }),
      this.prisma.chatMessage.findMany({
        where,
        include: { author: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { items: items.reverse(), total };
  }

  // isHtml is only ever set for a message sent straight from a canned
  // response, so the formatting it was authored with survives into the chat.
  // The body is re-sanitized here regardless of what the client claimed —
  // this is the last point before it's persisted and broadcast to a
  // visitor's browser, and the flag itself is client-supplied.
  async saveMessage(
    sessionId: string,
    body: string,
    role: 'visitor' | 'operator',
    authorId?: number,
    isInternal = false,
    isHtml = false,
  ) {
    const safeHtml = isHtml && hasMarkup(body);
    return this.prisma.chatMessage.create({
      data: {
        sessionId,
        body: safeHtml ? sanitizeRichText(body) : body,
        role,
        authorId,
        isInternal,
        isHtml: safeHtml,
      },
      include: { author: { select: { id: true, displayName: true } } },
    });
  }

  async assignOperator(sessionId: string, operatorId: number | null) {
    // Stamp assignedAt only the first time this session gets an operator —
    // a later reassignment (supervisor moving it to someone else) shouldn't
    // reset the "waiting time" metric.
    const current = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { assignedAt: true },
    });
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        operatorId,
        ...(operatorId !== null && !current?.assignedAt ? { assignedAt: new Date() } : {}),
      },
      include: {
        operator: { select: { id: true, displayName: true, avatarMediaId: true } },
        knownUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarMediaId: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
            roles: { select: { role: { select: { name: true, slug: true } } } },
          },
        },
        closedByOperator: { select: { id: true, displayName: true, avatarMediaId: true } },
      },
    });
  }

  async closeSession(sessionId: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: 'closed', closedAt: new Date() },
      include: { operator: { select: OPERATOR_SELECT } },
    });
  }

  // resolutionTag is never client-supplied — every call site passes one of
  // CHAT_CLOSE_REASONS explicitly, so the caller states *why* the session
  // is closing rather than the operator picking a reason from a list.
  async closeSessionWithResolution(
    sessionId: string,
    operatorId: number | null,
    resolutionTag: string,
    dto: CloseSessionWithResolutionDto = {},
  ) {
    const hasContactRequest =
      dto.contactRequestName ||
      dto.contactRequestPhone ||
      dto.contactRequestEmail ||
      dto.contactRequestMessage;
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByOperatorId: operatorId,
        resolutionTag,
        closureSummary: dto.closureSummary,
        regionId: dto.regionId,
        programId: dto.programId,
        ...(dto.contactInfoLeft ? { contactInfoLeft: true } : {}),
        ...(hasContactRequest
          ? {
              contactRequestName: dto.contactRequestName,
              contactRequestPhone: dto.contactRequestPhone,
              contactRequestEmail: dto.contactRequestEmail,
              contactRequestMessage: dto.contactRequestMessage,
              contactRequestEmailSent: dto.contactRequestEmailSent,
              contactRequestAt: new Date(),
            }
          : {}),
      },
      include: SESSION_INCLUDE,
    });
  }

  // Updates contactRequestEmailSent after the fact, once the fire-and-forget
  // mail send in ChatGateway.handleVisitorLeaveContactInfo actually resolves
  // — the session closes immediately without waiting on SMTP, so this flag
  // starts false and only flips to true on confirmed success. Best-effort:
  // swallow errors, a stale flag isn't worth failing anything over.
  async markContactRequestEmailSent(sessionId: string, sent: boolean): Promise<void> {
    try {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { contactRequestEmailSent: sent },
      });
    } catch {
      // Session may have been hard-deleted in the meantime — fine to ignore.
    }
  }

  // PATCH sessions/:id/details — region/program/comment settable any time
  // during a session (not just at close), from the operator's info panel.
  async updateSessionDetails(sessionId: string, dto: UpdateSessionDetailsDto) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        ...(dto.regionId !== undefined ? { regionId: dto.regionId } : {}),
        ...(dto.programId !== undefined ? { programId: dto.programId } : {}),
        ...(dto.closureSummary !== undefined ? { closureSummary: dto.closureSummary } : {}),
      },
      include: SESSION_INCLUDE,
    });
  }

  async reopenSession(sessionId: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: 'open', closedAt: null },
      include: SESSION_INCLUDE,
    });
  }

  async rateSession(sessionId: string, rating: number, comment?: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { visitorRating: rating, visitorRatingComment: comment || null },
      select: { id: true, visitorRating: true, visitorRatingComment: true },
    });
  }

  async getSession(sessionId: string) {
    return this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        operator: { select: OPERATOR_SELECT },
        knownUser: { select: KNOWN_USER_SELECT },
        closedByOperator: { select: OPERATOR_SELECT },
      },
    });
  }

  // Stamped whenever the visitor's widget has the session's messages in
  // view — lets the operator side show a "Seen" marker on their own
  // messages once visitorLastReadAt catches up to a given message's
  // createdAt. There's no equivalent operator-side read marker (see
  // ChatSession comment) — the visitor widget doesn't surface one.
  async markVisitorRead(sessionId: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { visitorLastReadAt: new Date() },
      select: { id: true, visitorLastReadAt: true },
    });
  }

  // ── Operator capacity / waiting queue ──────────────────────────

  async getActiveCountsByOperators(operatorIds: number[]): Promise<Map<number, number>> {
    if (operatorIds.length === 0) return new Map();

    const rows = await this.prisma.chatSession.groupBy({
      by: ['operatorId'],
      where: { status: 'open', operatorId: { in: operatorIds } },
      _count: { _all: true },
    });

    const counts = new Map<number, number>();
    for (const row of rows) {
      if (row.operatorId !== null) counts.set(row.operatorId, row._count._all);
    }
    return counts;
  }

  async getActiveSessionCount(operatorId: number): Promise<number> {
    return this.prisma.chatSession.count({
      where: { status: 'open', operatorId },
    });
  }

  async getNextQueuedSession() {
    return this.prisma.chatSession.findFirst({
      where: { status: 'open', operatorId: null },
      orderBy: { startedAt: 'asc' },
      include: SESSION_INCLUDE,
    });
  }

  // Role slug alone isn't enough to exclude supervisors — an account can
  // hold both the operator role and supervisor (chat.close) permissions at
  // once (e.g. a testing/admin account), so filter those out explicitly via
  // the same isOperatorSupervisor check pickAvailableOperator/drainQueue
  // already use, rather than trusting role slug to be mutually exclusive.
  async getOperators(excludeUserId: number) {
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { slug: 'operator' } } },
      },
      select: { id: true, displayName: true, avatarMediaId: true },
      orderBy: { displayName: 'asc' },
    });
    const supervisorFlags = await Promise.all(
      candidates.map((c) => this.isOperatorSupervisor(c.id)),
    );
    return candidates.filter((_, i) => !supervisorFlags[i]);
  }

  // Singleton row (id fixed to 1) — created on first read if it doesn't
  // exist yet (fresh DB never seeded with one). See ChatConfig comment in
  // schema.prisma.
  async getChatConfig() {
    return this.prisma.chatConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  // Partial update — every field optional, only what a supervisor actually
  // changed in the config panel gets written. Validation of the individual
  // fields (range/enum) already happened in UpdateChatConfigDto.
  async updateChatConfig(dto: {
    maxActiveChats?: number;
    notificationSound?: string;
    notificationVolume?: number;
    notificationDuration?: number;
    notificationPitch?: number;
    notificationRepeatCount?: number;
    newChatNotificationSound?: string;
    newChatNotificationVolume?: number;
    newChatNotificationDuration?: number;
    newChatNotificationPitch?: number;
    newChatNotificationRepeatCount?: number;
    visitorNotificationSound?: string;
    visitorNotificationVolume?: number;
    visitorNotificationDuration?: number;
    visitorNotificationPitch?: number;
    visitorNotificationRepeatCount?: number;
    visitorSentNotificationSound?: string;
    visitorSentNotificationVolume?: number;
    visitorSentNotificationDuration?: number;
    visitorSentNotificationPitch?: number;
    visitorSentNotificationRepeatCount?: number;
    operatorSentNotificationSound?: string;
    operatorSentNotificationVolume?: number;
    operatorSentNotificationDuration?: number;
    operatorSentNotificationPitch?: number;
    operatorSentNotificationRepeatCount?: number;
  }) {
    return this.prisma.chatConfig.upsert({
      where: { id: 1 },
      update: { ...dto },
      create: { id: 1, ...dto },
    });
  }

  // Public, unauthenticated read for the visitor widget — only the
  // visitor-* fields, not the full row (operator maxActiveChats etc. isn't
  // the visitor's business). Two categories: `received` for an incoming
  // operator reply, `sent` for the visitor's own outgoing message.
  async getVisitorNotificationConfig() {
    const config = await this.getChatConfig();
    return {
      received: {
        sound: config.visitorNotificationSound,
        volume: config.visitorNotificationVolume,
        duration: config.visitorNotificationDuration,
        pitch: config.visitorNotificationPitch,
        repeatCount: config.visitorNotificationRepeatCount,
      },
      sent: {
        sound: config.visitorSentNotificationSound,
        volume: config.visitorSentNotificationVolume,
        duration: config.visitorSentNotificationDuration,
        pitch: config.visitorSentNotificationPitch,
        repeatCount: config.visitorSentNotificationRepeatCount,
      },
    };
  }

  // Light lookup for the gateway's inactivity timer, which only has a
  // sessionId in scope at fire time — avoids pulling the full session
  // (with operator/knownUser includes) just to read one column.
  async getVisitorLanguage(sessionId: string): Promise<string | null> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { visitorLanguage: true },
    });
    return session?.visitorLanguage ?? null;
  }

  async isOperatorSupervisor(operatorId: number): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        id: operatorId,
        OR: [
          {
            roles: {
              some: {
                role: {
                  permissions: {
                    some: { permission: { key: 'chat.close' } },
                  },
                },
              },
            },
          },
          {
            userPermissions: {
              some: { permission: { key: 'chat.close' }, granted: true },
            },
          },
        ],
      },
    });
    return count > 0;
  }
}
