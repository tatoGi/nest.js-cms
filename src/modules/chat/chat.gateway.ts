import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Inject,
  Logger,
  OnModuleInit,
  UseGuards,
  UseFilters,
  UsePipes,
  ValidationPipe,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { parse as parseCookieHeader } from 'cookie';
import { AuthService } from '@/modules/auth/auth.service';
import { JwtUser } from '@/modules/auth/interface/jwt-user.interface';
import { ChatService, ChatCloseReason } from './application/chat.service';
import { DmService } from './application/dm.service';
import { ChatMailService } from './application/chat-mail.service';
import { CannedResponseService } from './application/canned-response.service';
import { OperatorRotationService } from './application/operator-rotation.service';
import { CHAT_EVENTS } from './chat-events.constants';
import { AuthenticatedSocket } from './chat-socket.types';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import {
  StartSessionDto,
  CloseSessionWithResolutionDto,
  LeaveContactInfoDto,
  SendMessageDto,
  OperatorSendMessageDto,
  DmMessageDto,
} from './dto/chat.dto';
import {
  AUTO_MESSAGE_DEFAULTS,
  AUTO_MESSAGE_TRIGGERS,
  type AutoMessageTrigger,
} from './application/auto-message.constants';
import { getBusinessTimezone } from './application/timezone.util';
import { KeyedTimerRegistry } from '@/common/scheduling/keyed-timer-registry';
import { SlidingWindowRateLimiter } from '@/common/rate-limit/sliding-window-rate-limiter';

// Max messages a single socket may send via visitor:message/operator:message/
// dm:message within RATE_LIMIT_WINDOW_MS — a simple in-memory sliding window
// keyed by socket id, consistent with the gateway's other in-memory Maps
// (onlineOperators, inactivityTimers). Single-instance only, same caveat as
// the rest of this class's state — see chat-plan notes on horizontal scaling.
const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 10_000;

interface InactivityTimerEntry {
  warningTimer: NodeJS.Timeout;
  closeTimer?: NodeJS.Timeout;
}

// Manually-settable preference (client can request any of these three) vs
// the full effective status, which also includes 'offline' (absence from
// onlineOperators). 'busy' can be set directly by the operator OR derived by
// the server once active-chat count hits MAX_ACTIVE_CHATS — either way it
// excludes the operator from auto-assignment. See
// .forge/decisions/chat-operator-status-plan.md.
type OperatorPreference = 'online' | 'away' | 'busy';
export type OperatorStatus = OperatorPreference | 'offline';

interface OperatorPresence {
  socketId: string;
  preference: OperatorPreference;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/chat',
  // Engine.IO defaults (25s interval / 20s timeout) are tuned for servers,
  // not backgrounded browser tabs — Chrome/Firefox throttle a hidden tab's
  // timers enough that the client can miss a ping cycle without the
  // operator having actually left. A longer timeout tolerates that lag
  // instead of tripping handleDisconnect (and the 10-min operator-offline
  // grace timer on top of it) for what's really just a background tab.
  pingInterval: 25_000,
  pingTimeout: 60_000,
})
@UseFilters(WsExceptionFilter)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // operatorId → { socketId, preference } (one active socket per operator).
  // 'offline' is simply the absence of an entry here — no separate flag.
  private onlineOperators = new Map<number, OperatorPresence>();

  // Maximum number of concurrently open sessions an operator may hold before
  // new/waiting visitors are left in the queue instead of being auto-assigned.
  // Supervisor-configurable (ChatConfig singleton row) — cached here and
  // refreshed on boot and whenever a supervisor saves a new value (see
  // ChatController.updateChatConfig → invalidateChatConfigCache), same
  // pattern as autoMessageCache below.
  private maxActiveChats = 3;

  // Per-session inactivity timers — ephemeral, in-memory, mirrors the
  // onlineOperators pattern. Lost on server restart (re-armed on the next
  // message or visitor:rejoin); no schema change, no cron scan. See
  // .forge/decisions/chat-messaging-email-plan.md for the full rationale.
  private inactivityTimers = new Map<string, InactivityTimerEntry>();

  // Per-session queue_wait message timer — supervisor-configurable delay
  // before telling a newly-queued visitor they're waiting (business hours
  // only; queue_contact_offer's off-hours counterpart fires immediately
  // instead, with no timer needed). Cleared the moment an operator is
  // actually assigned (see notifyAssignment) or the session closes some
  // other way.
  private readonly queueWaitTimers = new KeyedTimerRegistry('queue-wait');

  // Two-stage warn-then-close timer for a session that's queued and
  // unassigned (business-hours-all-busy or off-hours — either way, no
  // operator has joined) and never gets a message, contact-info submission,
  // or assignment. Structurally identical to inactivityTimers (a warning
  // setTimeout that, on firing, schedules the close setTimeout) — kept as
  // its own Map rather than merged with inactivityTimers because the two
  // are mutually exclusive by session phase (see armInactivityTimer's
  // operatorId gating) and mixing their keys would make that boundary
  // easy to violate by accident.
  private queueAbandonTimers = new Map<string, InactivityTimerEntry>();

  // Cache of the automatic-message rows (text/delay/enabled), refreshed on
  // boot and whenever a supervisor saves an update via the REST endpoint
  // (see ChatController.updateAutoMessage → invalidateAutoMessageCache).
  // Avoids a DB round-trip on every greeting/queue-wait/inactivity event.
  private autoMessageCache = new Map<
    AutoMessageTrigger,
    Awaited<ReturnType<CannedResponseService['getAutoMessage']>>
  >();

  // Per-socket sliding-window message timestamps for the rate limiter — see
  // RATE_LIMIT_MAX_MESSAGES/RATE_LIMIT_WINDOW_MS above. Cleared on disconnect.
  private readonly messageRateLimiter = new SlidingWindowRateLimiter(
    RATE_LIMIT_MAX_MESSAGES,
    RATE_LIMIT_WINDOW_MS,
  );

  // socketId -> sessionId for visitor sockets — lets handleDisconnect find
  // which session a dropped socket belonged to. Socket.IO has already left
  // every room by the time the 'disconnect' event fires, so client.rooms
  // can't be used for this lookup; this map is the only record of it.
  private visitorSessionSockets = new Map<string, string>();

  // sessionId -> grace timer, armed on visitor disconnect (see
  // handleDisconnect) so a real tab-close/browser-quit closes the session
  // automatically instead of sitting open for the full inactivity timeout.
  // Cancelled the moment the visitor reconnects (handleVisitorRejoin) within
  // the grace window — that's what keeps an ordinary page refresh from
  // closing the chat out from under them.
  private readonly visitorDisconnectTimers = new KeyedTimerRegistry('visitor-disconnect');
  private static readonly VISITOR_DISCONNECT_GRACE_MS = 15_000;

  // operatorId → grace timer, armed on operator disconnect (see
  // handleDisconnect) instead of marking them offline immediately. A
  // backgrounded/frozen browser tab (another tab, laptop sleep) drops the
  // socket without the operator actually leaving — this grace window keeps
  // them online/eligible for rotation through that, and only actually
  // removes them + broadcasts offline if they don't reconnect in time.
  // Cancelled the moment they reconnect (handleOperatorJoin). Matched to the
  // 2-minute useHeartbeat cadence (CMS) with a generous buffer, since a
  // throttled background tab can delay the heartbeat's own timer too.
  private readonly operatorDisconnectTimers = new KeyedTimerRegistry('operator-disconnect');
  private static readonly OPERATOR_DISCONNECT_GRACE_MS = 10 * 60 * 1000;

  constructor(
    private readonly chatService: ChatService,
    private readonly dmService: DmService,
    private readonly chatMailService: ChatMailService,
    private readonly cannedResponseService: CannedResponseService,
    private readonly operatorRotation: OperatorRotationService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.invalidateAutoMessageCache();
    await this.invalidateChatConfigCache();
  }

  // Public so ChatController can call it right after a supervisor saves an
  // automatic-message change, keeping the cache eventually-consistent
  // without needing every read to hit the DB.
  async invalidateAutoMessageCache(): Promise<void> {
    for (const trigger of AUTO_MESSAGE_TRIGGERS) {
      this.autoMessageCache.set(trigger, await this.cannedResponseService.getAutoMessage(trigger));
    }
  }

  // Public so ChatController can call it right after a supervisor saves a
  // new maxActiveChats value — same eventually-consistent cache pattern as
  // invalidateAutoMessageCache above.
  async invalidateChatConfigCache(): Promise<void> {
    const config = await this.chatService.getChatConfig();
    this.maxActiveChats = config.maxActiveChats;
  }

  // languageCode is the visitor's chosen language (ChatSession.visitorLanguage,
  // e.g. "en"/"ka") — falls back to the base body/header/fields when
  // untranslated or unset. Public (not just gateway-internal) so
  // ChatController can resolve intro_form's text for the pre-session REST
  // endpoint the widget calls before any socket session/room exists.
  getAutoMessage(trigger: AutoMessageTrigger, languageCode?: string | null) {
    const cached = this.autoMessageCache.get(trigger) ?? {
      ...AUTO_MESSAGE_DEFAULTS[trigger],
      header: AUTO_MESSAGE_DEFAULTS[trigger].header ?? null,
      buttonText: AUTO_MESSAGE_DEFAULTS[trigger].buttonText ?? null,
      fields: AUTO_MESSAGE_DEFAULTS[trigger].fields ?? null,
      translations: {} as Record<string, string>,
      headerTranslations: {} as Record<string, string>,
      buttonTextTranslations: {} as Record<string, string>,
      fieldsTranslations: {} as Record<string, Record<string, string>>,
    };
    const body = (languageCode && cached.translations[languageCode]) || cached.body;
    const header = (languageCode && cached.headerTranslations[languageCode]) || cached.header;
    const buttonText =
      (languageCode && cached.buttonTextTranslations[languageCode]) || cached.buttonText;
    const fieldOverrides = languageCode ? cached.fieldsTranslations[languageCode] : undefined;
    const fields = cached.fields ? { ...cached.fields, ...fieldOverrides } : cached.fields;
    return { ...cached, body, header, buttonText, fields };
  }

  // close_confirm/session_ended aren't chat messages (see AUTO_MESSAGE_DEFAULTS
  // comment) — they're plain config the widget's own UI renders, so they go
  // out as their own small events to the session room rather than through
  // saveMessage/chat:message. Room-broadcast (not client.emit) so a
  // visitor:rejoin from a second tab picks it up too; operators' sockets
  // simply have no listener for these events.
  private emitCloseConfirmMessage(sessionId: string, visitorLanguage?: string | null): void {
    const msg = this.getAutoMessage('close_confirm', visitorLanguage);
    // rating_form is a separate trigger (its own CMS row) from close_confirm
    // — close_confirm only supplies the wrapping question/cancel-label,
    // rating_form supplies the star-rating widget's own text.
    const ratingMsg = this.getAutoMessage('rating_form', visitorLanguage);
    this.server.to(`session:${sessionId}`).emit(CHAT_EVENTS.CHAT_CLOSE_CONFIRM_MESSAGE, {
      header: msg.header,
      body: msg.body,
      buttonText: msg.buttonText,
      rating: ratingMsg.fields,
    });
  }

  private emitSessionEndedMessage(sessionId: string, visitorLanguage?: string | null): void {
    const msg = this.getAutoMessage('session_ended', visitorLanguage);
    this.server.to(`session:${sessionId}`).emit(CHAT_EVENTS.CHAT_SESSION_ENDED_MESSAGE, {
      header: msg.header,
      body: msg.body,
      buttonText: msg.buttonText,
    });
  }

  // Same ephemeral pattern as the two above — the widget only ever uses
  // this while the visitor is still queued (no operator), but it's cheap
  // and simple to resolve unconditionally alongside close_confirm.
  private emitQueueCloseConfirmMessage(sessionId: string, visitorLanguage?: string | null): void {
    const msg = this.getAutoMessage('queue_close_confirm', visitorLanguage);
    this.server
      .to(`session:${sessionId}`)
      .emit(CHAT_EVENTS.CHAT_QUEUE_CLOSE_CONFIRM_MESSAGE, { message: msg.body });
  }

  // Soft auth: verifies the same httpOnly `accessToken` cookie the REST API
  // trusts (see JwtStrategy) and, on success, stashes the live user record
  // on client.data.user — but never rejects the connection outright. Visitor
  // sockets have no cookie at all and must stay connectable; only specific
  // operator/DM handlers (see WsAuthGuard, applied per-handler below)
  // actually require client.data.user to be present. Socket.IO's handshake
  // bypasses Express/cookie-parser entirely, so the Cookie header is parsed
  // by hand here rather than reading req.cookies.
  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) return;
      const token = parseCookieHeader(cookieHeader).accessToken;
      if (!token) return;

      const payload = this.jwtService.verify<JwtUser>(token);
      const user = await this.authService.validateUser(payload.userId);
      if (user) client.data.user = user;
    } catch {
      // Invalid/expired token — leave client.data.user unset, same as a
      // genuinely anonymous (visitor) connection. Not logged as an error:
      // an expired cookie on an otherwise-idle browser tab is routine.
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.messageRateLimiter.forget(client.id);
    // Don't mark offline immediately — arm a grace timer instead (see
    // operatorDisconnectTimers) so an ordinary tab-switch/background-freeze
    // reconnect doesn't flicker the operator offline or drop them out of
    // rotation.
    for (const [opId, entry] of this.onlineOperators.entries()) {
      if (entry.socketId === client.id) {
        this.armOperatorDisconnectTimer(opId);
        break;
      }
    }

    // A visitor's tab may have just closed, or this may be an ordinary
    // refresh/network blip about to reconnect via visitor:rejoin — arm a
    // short grace timer rather than assuming the worst immediately.
    const sessionId = this.visitorSessionSockets.get(client.id);
    if (sessionId) {
      this.visitorSessionSockets.delete(client.id);
      this.armVisitorDisconnectTimer(sessionId);
    }
  }

  // Returns false (and notifies the client) once a socket exceeds
  // RATE_LIMIT_MAX_MESSAGES within RATE_LIMIT_WINDOW_MS — callers should
  // stop processing the current message when this returns false.
  private checkRateLimit(client: Socket): boolean {
    if (this.messageRateLimiter.tryConsume(client.id)) return true;
    client.emit(CHAT_EVENTS.CHAT_ERROR, { message: 'You are sending messages too quickly.' });
    return false;
  }

  // Pure read accessor for the REST layer (see chat-reporting-plan.md) —
  // GET /chat/dashboard needs "online operators" and this map is otherwise
  // gateway-private. No assignment/routing behavior is touched by this method.
  getOnlineOperatorIds(): number[] {
    return Array.from(this.onlineOperators.keys());
  }

  // ── Operator status (Online/Away/Busy/Offline) ─────────────────
  // See .forge/decisions/chat-operator-status-plan.md — Busy is either
  // manually set by the operator or auto-derived once active-chat count
  // hits MAX_ACTIVE_CHATS (whichever applies takes the same effect: excluded
  // from auto-assignment); offline is the absence of a map entry.

  private async getEffectiveStatus(operatorId: number): Promise<OperatorStatus> {
    const entry = this.onlineOperators.get(operatorId);
    if (!entry) return 'offline';

    const activeCount = await this.chatService.getActiveSessionCount(operatorId);
    if (activeCount >= this.maxActiveChats) return 'busy';
    return entry.preference;
  }

  private async broadcastStatus(operatorId: number): Promise<void> {
    const status = await this.getEffectiveStatus(operatorId);
    this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_STATUS_CHANGED, { operatorId, status });
  }

  private async buildStatusList(): Promise<Array<{ operatorId: number; status: OperatorStatus }>> {
    const operatorIds = Array.from(this.onlineOperators.keys());
    const statuses = await Promise.all(operatorIds.map((id) => this.getEffectiveStatus(id)));
    return operatorIds.map((operatorId, i) => ({ operatorId, status: statuses[i] }));
  }

  // ── Auto-assign / waiting queue helpers ────────────────────────
  // A "waiting" visitor is simply an open ChatSession with operatorId = null —
  // there is no separate queue table/status. Ordering is FIFO by startedAt.

  // Away or manually-Busy operators never receive queued/new visitors — a
  // manual Busy is treated exactly like being at MAX_ACTIVE_CHATS, even if
  // their real active count is lower. Supervisors (chat.close) are never
  // auto-assigned a visitor, regardless of their online/away toggle — they
  // observe/manage rather than staff the queue (they can still manually
  // claim a chat via operator:join_session). Shared by pickAvailableOperator
  // and every eligibility-change call site that needs to keep the rotation
  // queue (and its supervisor-facing broadcast) in sync — see broadcastQueue.
  private async computeEligibleOperatorIds(): Promise<number[]> {
    const onlineIds = Array.from(this.onlineOperators.entries())
      .filter(([, entry]) => entry.preference !== 'away' && entry.preference !== 'busy')
      .map(([operatorId]) => operatorId);
    if (onlineIds.length === 0) return [];

    const supervisorFlags = await Promise.all(
      onlineIds.map((id) => this.chatService.isOperatorSupervisor(id)),
    );
    return onlineIds.filter((_, i) => !supervisorFlags[i]);
  }

  // Syncs the rotation queue to the given eligible set and broadcasts the
  // resulting order to supervisors watching the Live Chat Monitor's
  // Operators tab. Called both after an actual assignment (rotation
  // advanced) and after any eligibility change (join/status/disconnect) that
  // doesn't itself go through pickNext, so the supervisor view never has to
  // wait for the next chat to arrive to reflect who's next in line.
  private async broadcastQueue(eligibleIds: number[]): Promise<void> {
    await this.operatorRotation.sync(eligibleIds);
    const queue = await this.operatorRotation.getQueueOrder();
    this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_QUEUE_UPDATED, queue);
  }

  private async pickAvailableOperator(): Promise<number | null> {
    const eligibleIds = await this.computeEligibleOperatorIds();
    if (eligibleIds.length === 0) return null;

    const counts = await this.chatService.getActiveCountsByOperators(eligibleIds);
    const underCapacityIds = new Set(
      eligibleIds.filter((id) => (counts.get(id) ?? 0) < this.maxActiveChats),
    );

    // Rotation, not least-loaded — see docs/chat.md. The Redis-backed queue
    // itself tracks turn order; this just hands it who's eligible and who
    // currently has capacity.
    const picked = await this.operatorRotation.pickNext(eligibleIds, underCapacityIds);
    await this.broadcastQueue(eligibleIds);
    return picked;
  }

  private async tryAssignSession(sessionId: string): Promise<void> {
    const operatorId = await this.pickAvailableOperator();
    if (operatorId === null) return; // no operator has capacity — stays queued

    const session = await this.chatService.assignOperator(sessionId, operatorId);
    await this.notifyAssignment(session);
  }

  private async notifyAssignment(
    session: Awaited<ReturnType<ChatService['assignOperator']>>,
  ): Promise<void> {
    // If the newly-assigned operator is online, join their socket to the
    // session room so they immediately receive chat:message / typing events.
    const operatorEntry = session.operatorId
      ? this.onlineOperators.get(session.operatorId)
      : undefined;
    if (operatorEntry) {
      // this.server is typed as Server but is the /chat Namespace at runtime
      const operatorSocket = (this.server as any).sockets.get(operatorEntry.socketId) as
        | Socket
        | undefined;
      operatorSocket?.join(`session:${session.id}`);
    }

    this.server.to(`session:${session.id}`).emit(CHAT_EVENTS.SESSION_UPDATED, session);
    this.server.to('operators').emit(CHAT_EVENTS.SESSION_UPDATED, session);

    if (session.operatorId) {
      // The visitor is no longer just waiting — cancel the queue_wait
      // message and the queue-abandon countdown, an operator has actually
      // joined now. The inactivity countdown armed just below is this
      // session's replacement timer for the phase that starts here.
      this.clearQueueWaitTimer(session.id);
      this.clearQueueAbandonTimer(session.id);
      void this.broadcastStatus(session.operatorId);

      // This is every automatic pending → active transition (immediate at
      // visitor:start, or later via drainQueue once capacity frees up) — the
      // one place both paths funnel through, so the greeting always fires
      // exactly once, whenever assignment actually happens.
      const greetingMsg = this.getAutoMessage('greeting', session.visitorLanguage);
      if (greetingMsg.isEnabled) {
        const greeting = await this.chatService.saveMessage(
          session.id,
          greetingMsg.body,
          'operator',
        );
        this.server.to(`session:${session.id}`).emit(CHAT_EVENTS.CHAT_MESSAGE, greeting);
      }

      // The inactivity countdown only makes sense once a conversation with
      // an operator has actually begun — arm it here, the single chokepoint
      // for every pending → active transition, instead of at visitor:start
      // (where the visitor may just be waiting in the queue).
      void this.armInactivityTimer(session.id, session.visitorLanguage);
    }
  }

  private async drainQueue(operatorId: number): Promise<void> {
    // An Away or manually-Busy operator's freed-up capacity is not
    // auto-filled — same exclusion as pickAvailableOperator, they can still
    // manually claim via operator:join_session/operator:message.
    const entry = this.onlineOperators.get(operatorId);
    if (entry?.preference === 'away' || entry?.preference === 'busy') return;

    // Supervisors are never auto-assigned (see pickAvailableOperator) — same
    // exclusion applies when their own capacity frees up.
    if (await this.chatService.isOperatorSupervisor(operatorId)) return;

    let activeCount = await this.chatService.getActiveSessionCount(operatorId);

    while (activeCount < this.maxActiveChats) {
      const next = await this.chatService.getNextQueuedSession();
      if (!next) break;

      const assigned = await this.chatService.assignOperator(next.id, operatorId);
      await this.notifyAssignment(assigned);
      activeCount++;
    }
  }

  // ── Mail / business-hours helpers ──────────────────────────────

  private isBusinessHours(): boolean {
    const timeZone = getBusinessTimezone();
    const startHour = Number(process.env.BUSINESS_HOURS_START ?? 9);
    const endHour = Number(process.env.BUSINESS_HOURS_END ?? 18);
    const workDays = (process.env.BUSINESS_HOURS_DAYS ?? '1,2,3,4,5')
      .split(',')
      .map((d) => Number(d.trim()));

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    }).formatToParts(new Date());

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const weekdayName = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);

    return workDays.includes(weekdayIndex) && hour >= startHour && hour < endHour;
  }

  // ── Session close (single funnel) ───────────────────────

  /**
   * Every way a session can end — visitor closed it, operator closed it,
   * inactivity timed out, the visitor's tab went away, contact info was left
   * instead of waiting — performs the same five steps, and previously spelled
   * all five out at each of the five call sites. Any change (a new event, a
   * new timer to clear) had to be replicated by hand five times, and a missed
   * one stays invisible until that specific close path misbehaves.
   *
   * Each caller now keeps only what genuinely differs: the close reason, who
   * closed it, extra persisted details, and whose queue to drain.
   */
  private async closeSessionAndBroadcast(params: {
    sessionId: string;
    reason: ChatCloseReason;
    closedByOperatorId?: number | null;
    details?: CloseSessionWithResolutionDto;
    /**
     * Emitted before session:closed so the widget can tell an automatic
     * timeout apart from someone deliberately ending the chat. Only the
     * inactivity path sets this.
     */
    emitAutoClosed?: boolean;
    /**
     * Whose capacity just freed up. Defaults to the session's own assigned
     * operator; the operator-initiated path passes the closer explicitly,
     * since a supervisor may close a chat assigned to somebody else.
     */
    drainForOperatorId?: number;
  }) {
    const { sessionId, reason, closedByOperatorId = null, details, emitAutoClosed } = params;

    this.clearSessionTimers(sessionId);

    // `details` is omitted rather than passed as undefined when a caller has
    // none, so the call keeps the exact arity each path used before this
    // funnel existed (closeSessionWithResolution defaults it, so the two are
    // equivalent at runtime — this just avoids a gratuitous signature change).
    const session = details
      ? await this.chatService.closeSessionWithResolution(
          sessionId,
          closedByOperatorId,
          reason,
          details,
        )
      : await this.chatService.closeSessionWithResolution(sessionId, closedByOperatorId, reason);

    if (emitAutoClosed) {
      this.server.to(`session:${sessionId}`).emit(CHAT_EVENTS.CHAT_AUTO_CLOSED, session);
    }
    this.server.to(`session:${sessionId}`).emit(CHAT_EVENTS.SESSION_CLOSED, session);
    this.server.to('operators').emit(CHAT_EVENTS.SESSION_CLOSED, session);
    this.emitSessionEndedMessage(sessionId, session.visitorLanguage);

    const drainFor = params.drainForOperatorId ?? session.operatorId;
    if (drainFor) {
      await this.drainQueue(drainFor);
      await this.broadcastStatus(drainFor);
    }

    return session;
  }

  /**
   * A closed session has no use for any of its pending timers. Clearing all
   * four unconditionally is safe: each callback re-checks that the session is
   * still open before acting, so a stale timer was already a no-op — this just
   * stops it from lingering until it fires.
   */
  private clearSessionTimers(sessionId: string): void {
    this.clearInactivityTimer(sessionId);
    this.clearQueueWaitTimer(sessionId);
    this.cancelVisitorDisconnectTimer(sessionId);
    this.clearQueueAbandonTimer(sessionId);
  }

  // ── Visitor disconnect grace-close ──────────────────────────────

  private cancelVisitorDisconnectTimer(sessionId: string): void {
    this.visitorDisconnectTimers.cancel(sessionId);
  }

  private armVisitorDisconnectTimer(sessionId: string): void {
    this.visitorDisconnectTimers.arm(sessionId, ChatGateway.VISITOR_DISCONNECT_GRACE_MS, () => {
      void this.closeAbandonedVisitorSession(sessionId);
    });
  }

  // Only actually marks the operator offline (removes them from
  // onlineOperators/rotation and broadcasts it) once the grace window above
  // elapses with no reconnect. handleOperatorJoin cancels this the moment
  // they come back, so a reconnect within the window is invisible to the
  // rest of the team — no offline/online flicker, no gap in rotation
  // eligibility.
  // TODO(stakeholder decision, see docs/plan.md Stream B1): consider setting
  // 'away' instead of deleting outright, so supervisors see a softer signal
  // than a hard offline disappearance. Needs an autoAway flag first so
  // handleOperatorJoin can tell this apart from a manually-chosen away.
  private armOperatorDisconnectTimer(operatorId: number): void {
    this.operatorDisconnectTimers.arm(
      String(operatorId),
      ChatGateway.OPERATOR_DISCONNECT_GRACE_MS,
      () => this.markOperatorOffline(operatorId),
    );
  }

  // Shared by the grace-timer expiry above and forceOperatorOffline below —
  // removes the operator from onlineOperators/rotation and broadcasts it.
  private markOperatorOffline(operatorId: number): void {
    if (!this.onlineOperators.delete(operatorId)) return;
    this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_OFFLINE, { operatorId });
    this.server
      .to('operators')
      .emit(CHAT_EVENTS.OPERATOR_STATUS_CHANGED, { operatorId, status: 'offline' });
    void this.computeEligibleOperatorIds()
      .then((ids) => this.broadcastQueue(ids))
      .catch((err) => this.logger.error('operator-offline queue broadcast failed', err));
  }

  // Called by AuthService.logout() — an explicit "I'm leaving" action, unlike
  // a bare socket disconnect (handleDisconnect/armOperatorDisconnectTimer
  // above), so it skips OPERATOR_DISCONNECT_GRACE_MS entirely instead of
  // waiting out the window meant for accidental drops (frozen tab, laptop
  // sleep). Per stakeholder decision: logout must reflect offline to
  // supervisors immediately, not after up to 10 minutes.
  forceOperatorOffline(operatorId: number): void {
    this.operatorDisconnectTimers.cancel(String(operatorId));
    this.markOperatorOffline(operatorId);
  }

  // Mirrors autoCloseForInactivity below, but triggered by the visitor's
  // socket dropping and never reconnecting within the grace window, instead
  // of a long idle period on an otherwise-live connection.
  private async closeAbandonedVisitorSession(sessionId: string): Promise<void> {
    try {
      const existing = await this.chatService.getSession(sessionId);
      // Already closed some other way (manual close, inactivity timeout, an
      // operator) while this timer was pending — nothing to do.
      if (!existing || existing.status !== 'open') return;
      await this.closeSessionAndBroadcast({
        sessionId,
        reason: ChatCloseReason.CLIENT_CLOSED,
      });
    } catch (err) {
      this.logger.error('closeAbandonedVisitorSession failed', err);
    }
  }

  // ── Inactivity warning / auto-close helpers ────────────────────

  private clearInactivityTimer(sessionId: string): void {
    const existing = this.inactivityTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing.warningTimer);
      if (existing.closeTimer) clearTimeout(existing.closeTimer);
      this.inactivityTimers.delete(sessionId);
    }
  }

  // visitorLanguage: pass it when already in scope (e.g. from a freshly
  // fetched session) to skip the lookup; omit it to have this method fetch
  // it itself via the sessionId (used by handlers that only have an id).
  private async armInactivityTimer(
    sessionId: string,
    visitorLanguage?: string | null,
  ): Promise<void> {
    this.clearInactivityTimer(sessionId);

    const language =
      visitorLanguage !== undefined
        ? visitorLanguage
        : await this.chatService.getVisitorLanguage(sessionId);

    // Each trigger independently toggleable — if both are off, inactivity
    // handling is fully disabled for this session. If only close is off,
    // the warning still fires but the session is never auto-closed. If only
    // warning is off, no message is sent but the close timer still arms
    // after the same two-stage delay (silent countdown to close).
    const warningMsg = this.getAutoMessage('inactivity_warning', language);
    const closeMsg = this.getAutoMessage('inactivity_close', language);
    if (!warningMsg.isEnabled && !closeMsg.isEnabled) return;

    const warningDelayMs =
      (warningMsg.delaySeconds ?? AUTO_MESSAGE_DEFAULTS.inactivity_warning.delaySeconds ?? 300) *
      1000;
    const closeDelayMs =
      (closeMsg.delaySeconds ?? AUTO_MESSAGE_DEFAULTS.inactivity_close.delaySeconds ?? 300) * 1000;

    const warningTimer = setTimeout(() => {
      if (warningMsg.isEnabled) void this.fireInactivityWarning(sessionId, warningMsg.body);
      if (closeMsg.isEnabled) {
        const closeTimer = setTimeout(() => {
          void this.autoCloseForInactivity(sessionId);
        }, closeDelayMs);
        const entry = this.inactivityTimers.get(sessionId);
        if (entry) entry.closeTimer = closeTimer;
      }
    }, warningDelayMs);
    this.inactivityTimers.set(sessionId, { warningTimer });
  }

  private async fireInactivityWarning(sessionId: string, body: string): Promise<void> {
    try {
      const message = await this.chatService.saveMessage(sessionId, body, 'operator');
      this.server.to(`session:${sessionId}`).emit(CHAT_EVENTS.CHAT_MESSAGE, message);
      this.server
        .to(`session:${sessionId}`)
        .emit(CHAT_EVENTS.CHAT_INACTIVITY_WARNING, { sessionId });
      this.server.to('operators').emit(CHAT_EVENTS.CHAT_MESSAGE, message);
    } catch (err) {
      this.logger.error('fireInactivityWarning failed', err);
    }
  }

  private async autoCloseForInactivity(sessionId: string): Promise<void> {
    this.inactivityTimers.delete(sessionId);
    try {
      await this.closeSessionAndBroadcast({
        sessionId,
        reason: ChatCloseReason.INACTIVITY_TIMEOUT,
        emitAutoClosed: true,
      });
    } catch (err) {
      this.logger.error('autoCloseForInactivity failed', err);
    }
  }

  // ── Queue wait message helpers ──────────────────────────────────

  private clearQueueWaitTimer(sessionId: string): void {
    this.queueWaitTimers.cancel(sessionId);
  }

  private armQueueWaitTimer(sessionId: string, visitorLanguage?: string | null): void {
    this.clearQueueWaitTimer(sessionId);

    const msg = this.getAutoMessage('queue_wait', visitorLanguage);
    if (!msg.isEnabled) return;

    // Outside business hours, queue_contact_offer fires immediately and
    // already covers this — skip queue_wait so the visitor isn't shown
    // overlapping "please wait / leave your info" text at once. Online
    // operator count doesn't factor in here — during business hours a
    // visitor in queue always gets queue_wait, whether or not an operator
    // happens to be online right now.
    if (!this.isBusinessHours()) return;

    const delayMs = (msg.delaySeconds ?? AUTO_MESSAGE_DEFAULTS.queue_wait.delaySeconds ?? 0) * 1000;

    this.queueWaitTimers.arm(sessionId, delayMs, () => {
      void this.fireQueueWait(sessionId, msg.body);
    });
  }

  private async fireQueueWait(sessionId: string, body: string): Promise<void> {
    try {
      // Only still relevant if the visitor is genuinely still waiting —
      // an operator may have joined in the meantime (which would already
      // have cleared this timer, but guard anyway against any race).
      const session = await this.chatService.getSession(sessionId);
      if (!session || session.status !== 'open' || session.operatorId) return;

      // Shown as a popup on the visitor's own widget (not inserted into the
      // transcript) — same ephemeral pattern already used for
      // close_confirm/session_ended.
      this.server
        .to(`session:${sessionId}`)
        .emit(CHAT_EVENTS.CHAT_QUEUE_WAIT_MESSAGE, { sessionId, message: body });
    } catch (err) {
      this.logger.error('fireQueueWait failed', err);
    }
  }

  // ── Queue "still waiting?" offer (off-hours) ───────────────────

  // Fires immediately, never delayed — only ever called outside business
  // hours (or with zero operators online), where there's no one to wait
  // for. queue_wait is this trigger's business-hours counterpart; the two
  // never fire for the same session (see the callers of each).
  private async fireQueueContactOffer(
    sessionId: string,
    visitorLanguage?: string | null,
  ): Promise<void> {
    try {
      // Only still relevant if the visitor is genuinely still waiting —
      // an operator may have joined in the meantime, but guard anyway
      // against any race.
      const session = await this.chatService.getSession(sessionId);
      if (!session || session.status !== 'open' || session.operatorId) return;

      const msg = this.getAutoMessage('queue_contact_offer', visitorLanguage);
      if (!msg.isEnabled) return;
      this.server
        .to(`session:${sessionId}`)
        .emit(CHAT_EVENTS.CHAT_QUEUE_CONTACT_OFFER, { sessionId, message: msg.body });
    } catch (err) {
      this.logger.error('fireQueueContactOffer failed', err);
    }
  }

  // ── Queue abandonment (warn, then close) ────────────────────────
  // Covers a session that's queued and unassigned — whether that's because
  // it's outside business hours (queue_contact_offer already shown) or every
  // operator is busy during business hours (queue_wait already shown) — and
  // never gets a message, a contact-info submission, or an operator. Without
  // this, such a session sits open forever: armInactivityTimer only ever
  // arms once operatorId is set (see its call sites), so nothing else in the
  // gateway would ever warn the visitor or close it. Same two-stage
  // warning-then-close shape as inactivityTimers/armInactivityTimer, kept as
  // its own Map (see the field's own comment) rather than sharing one.

  private clearQueueAbandonTimer(sessionId: string): void {
    const existing = this.queueAbandonTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing.warningTimer);
      if (existing.closeTimer) clearTimeout(existing.closeTimer);
      this.queueAbandonTimers.delete(sessionId);
    }
  }

  private armQueueAbandonTimer(sessionId: string, visitorLanguage?: string | null): void {
    this.clearQueueAbandonTimer(sessionId);

    const warningMsg = this.getAutoMessage('queue_abandon_warning', visitorLanguage);
    const closeMsg = this.getAutoMessage('queue_abandon_close', visitorLanguage);
    if (!warningMsg.isEnabled && !closeMsg.isEnabled) return;

    const warningDelayMs =
      (warningMsg.delaySeconds ?? AUTO_MESSAGE_DEFAULTS.queue_abandon_warning.delaySeconds ?? 600) *
      1000;
    const closeDelayMs =
      (closeMsg.delaySeconds ?? AUTO_MESSAGE_DEFAULTS.queue_abandon_close.delaySeconds ?? 300) *
      1000;

    const warningTimer = setTimeout(() => {
      if (warningMsg.isEnabled) void this.fireQueueAbandonWarning(sessionId, warningMsg.body);
      if (closeMsg.isEnabled) {
        const closeTimer = setTimeout(() => {
          void this.autoCloseForQueueAbandonment(sessionId);
        }, closeDelayMs);
        const entry = this.queueAbandonTimers.get(sessionId);
        if (entry) entry.closeTimer = closeTimer;
      }
    }, warningDelayMs);
    this.queueAbandonTimers.set(sessionId, { warningTimer });
  }

  private async fireQueueAbandonWarning(sessionId: string, body: string): Promise<void> {
    try {
      // Only still relevant if genuinely still queued and unassigned — an
      // operator may have joined, or the visitor may have acted, in the
      // meantime (both already cancel this timer, but guard anyway against
      // any race).
      const session = await this.chatService.getSession(sessionId);
      if (!session || session.status !== 'open' || session.operatorId) return;

      // Ephemeral popup, not inserted into the transcript — same pattern as
      // queue_wait/queue_contact_offer, which this supersedes on the widget.
      this.server
        .to(`session:${sessionId}`)
        .emit(CHAT_EVENTS.CHAT_QUEUE_ABANDON_WARNING, { sessionId, message: body });
    } catch (err) {
      this.logger.error('fireQueueAbandonWarning failed', err);
    }
  }

  private async autoCloseForQueueAbandonment(sessionId: string): Promise<void> {
    this.queueAbandonTimers.delete(sessionId);
    try {
      // Mirrors closeAbandonedVisitorSession's guard: cheap insurance
      // against a race with assignment/activity in the split second before
      // this fires, even though every other path already cancels this timer.
      const session = await this.chatService.getSession(sessionId);
      if (!session || session.status !== 'open' || session.operatorId) return;

      await this.closeSessionAndBroadcast({
        sessionId,
        // Reuses the existing "system timed the session out" reason rather
        // than adding a 4th resolutionTag — reporting/export/the CMS's
        // trigger-config Records all currently assume a fixed 3-value set
        // (see chat-reporting.service.ts), and a queued session that never
        // got a reply is the same story as one that went idle after a reply,
        // just earlier in the lifecycle.
        reason: ChatCloseReason.INACTIVITY_TIMEOUT,
        emitAutoClosed: true,
      });
    } catch (err) {
      this.logger.error('autoCloseForQueueAbandonment failed', err);
    }
  }

  // ── Visitor: start a new chat session ─────────────────────────
  // Real client IP, not client-reported — mirrors the REST-side x-forwarded-for
  // extraction in common/helper/action-meta.ts (app has `trust proxy` set in
  // main.ts). Socket.IO's handshake carries the same proxy headers as the
  // original HTTP upgrade request.
  private getClientIp(client: Socket): string | undefined {
    const forwarded = client.handshake.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return client.handshake.address;
  }

  @SubscribeMessage(CHAT_EVENTS.VISITOR_START)
  async handleVisitorStart(@MessageBody() dto: StartSessionDto, @ConnectedSocket() client: Socket) {
    try {
      const session = await this.chatService.startSession({
        ...dto,
        visitorIp: this.getClientIp(client),
      });
      client.join(`session:${session.id}`);
      this.visitorSessionSockets.set(client.id, session.id);
      this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_NEW_SESSION, session);
      this.emitCloseConfirmMessage(session.id, session.visitorLanguage);
      this.emitQueueCloseConfirmMessage(session.id, session.visitorLanguage);

      // Attempt immediate auto-assignment first, so we know which single
      // opening message actually fits — greeting for "you're active with an
      // operator" (sent by notifyAssignment itself, inside tryAssignSession,
      // the same chokepoint a later drainQueue-driven assignment uses too),
      // queue_wait for "you're pending". Sending both back to back (e.g.
      // "how can I help?" immediately followed by "actually everyone's
      // busy") reads as contradictory, so only one ever goes out here.
      await this.tryAssignSession(session.id);
      const afterAssign = await this.chatService.getSession(session.id);

      if (afterAssign && !afterAssign.operatorId) {
        this.armQueueWaitTimer(session.id, afterAssign.visitorLanguage);
        // Runs regardless of business hours — it's the queued-and-
        // unassigned session's own countdown, independent of whichever of
        // queue_wait/queue_contact_offer fired above.
        this.armQueueAbandonTimer(session.id, afterAssign.visitorLanguage);

        // Internal safety-net email — a genuinely offline team (zero
        // operators, outside hours), independent of what the visitor sees.
        if (this.onlineOperators.size === 0 && !this.isBusinessHours()) {
          void this.chatMailService.sendNoOperatorAvailableNotice({
            visitorName: dto.visitorName,
            visitorEmail: dto.visitorEmail,
            visitorPhone: dto.visitorPhone,
          });
        }

        // Outside working hours — queue_contact_offer fires immediately, in
        // place of queue_wait (armed above but self-gated to business hours
        // only, so it won't also fire for this same session). Online
        // operator count doesn't factor in — during business hours the
        // visitor always gets queue_wait, even with zero operators online.
        if (!this.isBusinessHours()) {
          await this.fireQueueContactOffer(session.id, afterAssign.visitorLanguage);
        }
      }

      // Inactivity timers are armed only once an operator actually joins
      // (see notifyAssignment) — a visitor waiting in the queue hasn't
      // started a conversation to go idle in. queueAbandonTimers (armed
      // above) is that phase's own equivalent instead.

      return { sessionId: session.id };
    } catch (err) {
      this.logger.error('visitor:start failed', err);
      // Explicit: the visitor's ack resolves with undefined on failure. Kept
      // as-is rather than switching to an error payload, which the widget
      // doesn't yet handle.
      return undefined;
    }
  }

  // ── Visitor: send a message ────────────────────────────────────
  @SubscribeMessage(CHAT_EVENTS.VISITOR_MESSAGE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async handleVisitorMessage(
    @MessageBody() payload: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.checkRateLimit(client)) return;
    try {
      const message = await this.chatService.saveMessage(
        payload.sessionId,
        payload.body,
        'visitor',
      );
      // Emit to session room (visitor + operators watching this session)
      this.server.to(`session:${payload.sessionId}`).emit(CHAT_EVENTS.CHAT_MESSAGE, message);
      // Notify operators NOT watching this session (for unread counters in session list)
      this.server
        .to('operators')
        .except(`session:${payload.sessionId}`)
        .emit(CHAT_EVENTS.CHAT_MESSAGE, message);
      // Once an operator has joined, this restarts the idle-conversation
      // countdown. While still queued/unassigned, a message is exactly the
      // opposite of abandonment — restart that countdown instead, rather
      // than leaving the visitor's own reply ignored by the timer meant to
      // catch silence.
      const session = await this.chatService.getSession(payload.sessionId);
      if (session?.operatorId) {
        void this.armInactivityTimer(payload.sessionId, session.visitorLanguage);
      } else if (session) {
        this.armQueueAbandonTimer(payload.sessionId, session.visitorLanguage);
      }
    } catch (err) {
      this.logger.error('visitor:message failed', err);
    }
  }

  // ── Visitor: still filling out the contact form ─────────────────
  // Widget-side debounced ping (see useChat.ts) fired while the visitor is
  // typing into queue_contact_offer/queue_wait's contact form but hasn't
  // submitted yet. Only matters for the queued-unassigned phase — once an
  // operator joins, the contact form isn't shown anymore and the regular
  // inactivity timer (reset by real messages) takes over. No DB write here,
  // just a timer reset, so this intentionally skips checkRateLimit's
  // message-send throttle — this is metadata, not chat content.
  @SubscribeMessage(CHAT_EVENTS.VISITOR_FORM_ACTIVITY)
  async handleVisitorFormActivity(@MessageBody() payload: { sessionId: string }) {
    try {
      const session = await this.chatService.getSession(payload.sessionId);
      if (!session || session.status !== 'open' || session.operatorId) return;
      this.armQueueAbandonTimer(payload.sessionId, session.visitorLanguage);
    } catch (err) {
      this.logger.error('visitor:form_activity failed', err);
    }
  }

  // ── Visitor: end their own chat ───────────────────────────────
  // Mirrors operator:close_session / autoCloseForInactivity — closing is
  // closing regardless of who initiated it, so the operator side (session
  // list, dashboard, supervisor monitor) must see it the same way.
  @SubscribeMessage(CHAT_EVENTS.VISITOR_CLOSE_SESSION)
  async handleVisitorCloseSession(
    @MessageBody() payload: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.closeSessionAndBroadcast({
        sessionId: payload.sessionId,
        reason: ChatCloseReason.CLIENT_CLOSED,
      });
    } catch (err) {
      this.logger.error('visitor:close_session failed', err);
      client.emit(CHAT_EVENTS.CHAT_ERROR, { message: 'Failed to close session' });
    }
  }

  // ── Visitor: leave contact info instead of continuing to wait ──
  // Offered via queue_wait/queue_contact_offer while queued, as an
  // alternative to waiting indefinitely for an operator. Emails the company
  // with the visitor's already-known contact details plus this optional
  // free-text message, then closes the session (there's no live
  // conversation to keep open — the visitor is choosing an async follow-up
  // instead).
  @SubscribeMessage(CHAT_EVENTS.VISITOR_LEAVE_CONTACT_INFO)
  async handleVisitorLeaveContactInfo(
    @MessageBody() payload: { sessionId: string } & LeaveContactInfoDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.clearQueueWaitTimer(payload.sessionId);
      const existing = await this.chatService.getSession(payload.sessionId);
      if (!existing) return;

      // name/phone/email are optional overrides — the queue_contact_offer
      // prompt doesn't collect them (reuses what the intro form already
      // has), but the no-operators-online notice shows a fuller form the
      // visitor may fill in/correct instead.
      // Fire-and-forget: the visitor shouldn't wait on SMTP (which can hang
      // for minutes on a slow/unreachable server) just to close their
      // session. contactRequestEmailSent starts false and is patched to the
      // real outcome once the send resolves (see .then below) — showing
      // "sent" before it's actually confirmed would mislead whoever reads
      // the session later.
      const emailSentPromise = this.chatMailService.sendContactRequestNotice({
        visitorName: payload.name || existing.visitorName,
        visitorEmail: payload.email || existing.visitorEmail,
        visitorPhone: payload.phone || existing.visitorPhone,
        message: payload.message,
      });
      void emailSentPromise.then((sent) =>
        this.chatService.markContactRequestEmailSent(payload.sessionId, sent),
      );

      // resolutionTag stays a real close reason (the visitor is the one
      // ending the session here, same as any other visitor-initiated close)
      // — contactInfoLeft is the dedicated flag for "did they submit this
      // form", kept independent so close-reason reporting/filtering isn't
      // fragmented by a 4th pseudo-reason.
      await this.closeSessionAndBroadcast({
        sessionId: payload.sessionId,
        reason: ChatCloseReason.CLIENT_CLOSED,
        details: {
          contactInfoLeft: true,
          contactRequestName: payload.name,
          contactRequestPhone: payload.phone,
          contactRequestEmail: payload.email,
          contactRequestMessage: payload.message,
          contactRequestEmailSent: false,
        },
      });
    } catch (err) {
      this.logger.error('visitor:leave_contact_info failed', err);
      client.emit(CHAT_EVENTS.CHAT_ERROR, { message: 'Failed to submit contact info' });
    }
  }

  // ── Operator: join operators room ─────────────────────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_JOIN)
  async handleOperatorJoin(
    @MessageBody() payload: { operatorId?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.join('operators');
    // Always send the current snapshot to whoever just joined the room —
    // supervisors watching the Live Chat Monitor need this too, even though
    // they don't register themselves as an online operator below.
    client.emit(CHAT_EVENTS.OPERATORS_ONLINE_LIST, Array.from(this.onlineOperators.keys()));
    try {
      client.emit(CHAT_EVENTS.OPERATORS_STATUS_LIST, await this.buildStatusList());
    } catch (err) {
      this.logger.error('operator:join status snapshot failed', err);
    }
    try {
      client.emit(CHAT_EVENTS.OPERATOR_QUEUE_UPDATED, await this.operatorRotation.getQueueOrder());
    } catch (err) {
      this.logger.error('operator:join queue snapshot failed', err);
    }
    // payload.operatorId is only ever used as an opt-in flag here ("register
    // me as an online, assignable operator" vs. "just watching") — the id
    // actually stored/broadcast always comes from the verified socket
    // identity (client.data.user), never the client-supplied number.
    if (payload?.operatorId) {
      const operatorId = client.data.user!.userId;
      // Cancel any pending offline-grace timer from a just-recovered
      // disconnect (see armOperatorDisconnectTimer) — this reconnect means
      // they never actually left.
      this.operatorDisconnectTimers.cancel(String(operatorId));
      // Reconnecting within the grace window (still holding an entry here)
      // must not reset an away/busy operator back to online — they never
      // told the system their status changed, their socket just blipped.
      // Only a genuinely fresh join (no prior entry) defaults to online.
      const priorPreference = this.onlineOperators.get(operatorId)?.preference ?? 'online';
      this.onlineOperators.set(operatorId, { socketId: client.id, preference: priorPreference });
      // Notify others this operator is online
      this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_ONLINE, { operatorId });
      try {
        await this.broadcastStatus(operatorId);
      } catch (err) {
        this.logger.error('operator:join status broadcast failed', err);
      }
      // This operator now has capacity — auto-pull queued visitors, if any.
      try {
        await this.drainQueue(operatorId);
      } catch (err) {
        this.logger.error('operator:join drainQueue failed', err);
      }
      try {
        await this.broadcastQueue(await this.computeEligibleOperatorIds());
      } catch (err) {
        this.logger.error('operator:join queue broadcast failed', err);
      }
    }
    this.logger.log(`Operator joined room: ${client.id} (id=${client.data.user?.userId})`);
  }

  // ── Operator: set their own status (online/away/busy — offline is ──────
  // ── always the absence of a connection, never client-settable) ─────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_SET_STATUS)
  async handleSetStatus(
    @MessageBody() payload: { status: OperatorPreference },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (payload.status !== 'online' && payload.status !== 'away' && payload.status !== 'busy') {
        client.emit(CHAT_EVENTS.CHAT_PERMISSION_ERROR, {
          message:
            'Only "online", "away", or "busy" can be set directly — offline is server-derived.',
        });
        return;
      }
      const operatorId = client.data.user!.userId;
      const entry = this.onlineOperators.get(operatorId);
      if (!entry) return; // not currently connected — nothing to update
      entry.preference = payload.status;
      await this.broadcastStatus(operatorId);
      // Switching back to Online can free up auto-assignable capacity that
      // a queued visitor was waiting on — every other capacity-freeing path
      // (close_session, operator:join, auto-close) already calls this;
      // going online was the one transition that didn't. No-ops for
      // away/busy and for operators already at capacity (see drainQueue).
      if (payload.status === 'online') {
        await this.drainQueue(operatorId);
      }
      // Away/busy drops them from the rotation queue; back to online
      // re-inserts them at the front, same as any other newly-eligible join
      // (see computeEligibleOperatorIds/broadcastQueue) — keeps the
      // supervisor-facing queue view in sync with this transition too.
      await this.broadcastQueue(await this.computeEligibleOperatorIds());
    } catch (err) {
      this.logger.error('operator:set_status failed', err);
    }
  }

  // ── Operator: join a specific session ─────────────────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_JOIN_SESSION)
  async handleOperatorJoinSession(
    @MessageBody() payload: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const operatorId = client.data.user!.userId;
      client.join(`session:${payload.sessionId}`);
      const session = await this.chatService.getSession(payload.sessionId);
      if (
        session &&
        session.status === 'open' &&
        !session.operatorId &&
        // Supervisors merely opening a queued chat to watch it must never
        // auto-claim it — same exclusion as auto-assignment (see
        // pickAvailableOperator/drainQueue). Everyone else claims on open.
        !(await this.chatService.isOperatorSupervisor(operatorId))
      ) {
        // MAX_ACTIVE_CHATS caps automatic assignment (pickAvailableOperator/
        // drainQueue) so overloaded operators are skipped — but a manual
        // accept here is a deliberate operator choice (the CMS already warns
        // them client-side when they're at capacity), so it's allowed
        // through uncapped rather than silently rejected.
        await this.chatService.assignOperator(payload.sessionId, operatorId);
        const updated = await this.chatService.getSession(payload.sessionId);
        this.server.to(`session:${payload.sessionId}`).emit(CHAT_EVENTS.SESSION_UPDATED, updated);
        // Supervisors/other operators watching the session list haven't
        // joined this session's own room — without this, a chat claimed via
        // "open to accept" (as opposed to replying, see operator:message)
        // stays looking queued for everyone but the claiming operator until
        // they happen to refresh.
        this.server.to('operators').emit(CHAT_EVENTS.SESSION_UPDATED, updated);
        await this.broadcastStatus(operatorId);
      }
    } catch (err) {
      this.logger.error('operator:join_session failed', err);
    }
  }

  // ── Operator: send a message to visitor ───────────────────────
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_MESSAGE)
  async handleOperatorMessage(
    @MessageBody() payload: OperatorSendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const operatorId = client.data.user!.userId;
    if (!this.checkRateLimit(client)) return;
    this.logger.log(
      `operator:message | socketId=${client.id} sessionId=${payload.sessionId} operatorId=${operatorId}`,
    );
    try {
      const session = await this.chatService.getSession(payload.sessionId);
      if (!session) {
        this.logger.warn(`operator:message | session not found: ${payload.sessionId}`);
        return;
      }

      if (!session.operatorId) {
        // Supervisors never claim a queued chat just by messaging it either —
        // same rule as operator:join_session/pickAvailableOperator.
        if (await this.chatService.isOperatorSupervisor(operatorId)) {
          client.emit(CHAT_EVENTS.CHAT_PERMISSION_ERROR, {
            message: 'Supervisors cannot claim a queued chat by messaging it.',
          });
          return;
        }
        const activeCount = await this.chatService.getActiveSessionCount(operatorId);
        if (activeCount >= this.maxActiveChats) {
          client.emit(CHAT_EVENTS.CHAT_CAPACITY_REACHED, {
            message: `You already have ${this.maxActiveChats} active chats. Close one before joining another.`,
          });
          return;
        }
        // First operator to reply claims the session
        await this.chatService.assignOperator(payload.sessionId, operatorId);
        const updated = await this.chatService.getSession(payload.sessionId);
        this.server.to(`session:${payload.sessionId}`).emit(CHAT_EVENTS.SESSION_UPDATED, updated);
        this.server.to('operators').emit(CHAT_EVENTS.SESSION_UPDATED, updated);
        await this.broadcastStatus(operatorId);
      } else if (session.operatorId !== operatorId) {
        // Assigned to someone else — only supervisors may override
        const isSupervisor = await this.chatService.isOperatorSupervisor(operatorId);
        if (!isSupervisor) {
          client.emit(CHAT_EVENTS.CHAT_PERMISSION_ERROR, {
            message: 'This session is assigned to another operator.',
          });
          return;
        }
      }

      const message = await this.chatService.saveMessage(
        payload.sessionId,
        payload.body,
        'operator',
        operatorId,
        false,
        // Set by the CMS only when the operator sent an unedited canned
        // response, so its formatting reaches the visitor as authored.
        // saveMessage re-sanitizes regardless — this flag is client-supplied
        // and never trusted on its own.
        payload.isHtml ?? false,
      );
      // Send to others in session room (visitor + other watching operators)
      client.to(`session:${payload.sessionId}`).emit(CHAT_EVENTS.CHAT_MESSAGE, message);
      // Always echo to sender so they see their own message even if not in the session room
      // (happens on socket reconnect before operator:join_session is re-emitted)
      client.emit(CHAT_EVENTS.CHAT_MESSAGE, message);
      void this.armInactivityTimer(payload.sessionId, session.visitorLanguage);
    } catch (err) {
      this.logger.error('operator:message failed', err);
    }
  }

  // ── Operator: close a session (with resolution) ───────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_CLOSE_SESSION)
  async handleCloseSession(
    @MessageBody() payload: { sessionId: string } & CloseSessionWithResolutionDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const operatorId = client.data.user!.userId;
      // Drains for the closing operator rather than the session's assigned
      // one — a supervisor may close a chat belonging to somebody else, and
      // it is the closer whose capacity just changed.
      await this.closeSessionAndBroadcast({
        sessionId: payload.sessionId,
        reason: ChatCloseReason.OPERATOR_CLOSED,
        closedByOperatorId: operatorId,
        details: { closureSummary: payload.closureSummary },
        drainForOperatorId: operatorId,
      });
    } catch (err) {
      this.logger.error('operator:close_session failed', err);
      client.emit(CHAT_EVENTS.CHAT_ERROR, { message: 'Failed to close session' });
    }
  }

  // ── Operator: reopen a closed session ─────────────────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_REOPEN_SESSION)
  async handleReopenSession(
    @MessageBody() payload: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const session = await this.chatService.reopenSession(payload.sessionId);
      this.server.to('operators').emit(CHAT_EVENTS.SESSION_REOPENED, session);
      client.join(`session:${session.id}`);
      client.emit(CHAT_EVENTS.SESSION_REOPENED, session);
      void this.armInactivityTimer(session.id, session.visitorLanguage);
    } catch (err) {
      this.logger.error('operator:reopen_session failed', err);
    }
  }

  // ── Operator: internal note (not forwarded to visitor) ────────
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_INTERNAL_NOTE)
  async handleInternalNote(
    @MessageBody() payload: OperatorSendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const message = await this.chatService.saveMessage(
        payload.sessionId,
        payload.body,
        'operator',
        client.data.user!.userId,
        true, // isInternal
      );
      this.server.to('operators').emit(CHAT_EVENTS.CHAT_MESSAGE, message);
    } catch (err) {
      this.logger.error('operator:internal_note failed', err);
    }
  }

  // ── Operator: typing indicator ─────────────────────────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.OPERATOR_TYPING)
  handleOperatorTyping(@MessageBody() payload: { sessionId: string; typing: boolean }) {
    this.server
      .to(`session:${payload.sessionId}`)
      .emit(CHAT_EVENTS.OPERATOR_TYPING, { typing: payload.typing });
  }

  // ── Visitor: typing indicator ──────────────────────────────────
  @SubscribeMessage(CHAT_EVENTS.VISITOR_TYPING)
  handleVisitorTyping(@MessageBody() payload: { sessionId: string; typing: boolean }) {
    this.server
      .to('operators')
      .emit(CHAT_EVENTS.VISITOR_TYPING, { sessionId: payload.sessionId, typing: payload.typing });
  }

  // ── Visitor: rate session ──────────────────────────────────────
  @SubscribeMessage(CHAT_EVENTS.VISITOR_RATE_SESSION)
  async handleRateSession(
    @MessageBody() payload: { sessionId: string; rating: number; comment?: string },
  ) {
    if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
      this.logger.warn(`visitor:rate_session | invalid rating: ${payload.rating}`);
      return;
    }
    try {
      await this.chatService.rateSession(
        payload.sessionId,
        payload.rating,
        payload.comment?.trim().slice(0, 1000),
      );
      const session = await this.chatService.getSession(payload.sessionId);
      if (session) {
        this.server.to(`session:${session.id}`).emit(CHAT_EVENTS.SESSION_UPDATED, session);
        this.server.to('operators').emit(CHAT_EVENTS.SESSION_UPDATED, session);
      }
    } catch (err) {
      this.logger.error('visitor:rate_session failed', err);
    }
  }

  // ── Visitor: mark the session's messages as seen ───────────────
  // Fired by the widget on open and whenever a new operator message arrives
  // while it's open (see useChat.ts). Broadcasts the same session:updated
  // event operators already listen for, so the CMS just needs to compare
  // visitorLastReadAt against its own last message — no new client event.
  @SubscribeMessage(CHAT_EVENTS.VISITOR_READ)
  async handleVisitorRead(
    @MessageBody() payload: { sessionId: string },
    @ConnectedSocket() _client: Socket,
  ) {
    try {
      const session = await this.chatService.markVisitorRead(payload.sessionId);
      this.server.to('operators').emit(CHAT_EVENTS.SESSION_UPDATED, session);
    } catch (err) {
      this.logger.error('visitor:read failed', err);
    }
  }

  // ── Visitor: rejoin existing session ──────────────────────────
  @SubscribeMessage(CHAT_EVENTS.VISITOR_REJOIN)
  async handleVisitorRejoin(
    @MessageBody() payload: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const session = await this.chatService.getSession(payload.sessionId);
      if (session) {
        client.join(`session:${payload.sessionId}`);
        this.visitorSessionSockets.set(client.id, payload.sessionId);
        // Reconnected (refresh, network blip, tab back in foreground) within
        // the grace window — cancel any pending abandoned-session close.
        this.cancelVisitorDisconnectTimer(payload.sessionId);
        // false — this goes straight to the visitor's own socket; internal
        // operator notes must never be included here (see getSessionMessages).
        const { items: messages } = await this.chatService.getSessionMessages(
          payload.sessionId,
          false,
        );
        client.emit(CHAT_EVENTS.SESSION_REJOINED, { session, messages });
        // Notify operators so sessions created via REST appear in the active list
        if (session.status === 'open') {
          this.server.to('operators').emit(CHAT_EVENTS.OPERATOR_NEW_SESSION, session);
          // Only arm if this process has no timer tracked for the session —
          // that's the "server restarted, in-memory map is empty" case this
          // is meant to cover. The widget re-emits visitor:rejoin on every
          // socket.io reconnect (network blips, backgrounded tabs, WS ping
          // timeouts), which is NOT genuine visitor activity — re-arming
          // unconditionally here would silently reset the idle countdown on
          // every reconnect, so a truly-idle visitor whose browser keeps
          // reconnecting in the background would never auto-close.
          if (session.operatorId && !this.inactivityTimers.has(session.id)) {
            void this.armInactivityTimer(session.id, session.visitorLanguage);
          }
          // Same "process restarted, in-memory map is empty" guard as above,
          // for the still-queued (no operator) case — mirrors
          // handleVisitorStart's own business-hours branching.
          if (!session.operatorId) {
            if (!this.queueWaitTimers.has(session.id)) {
              this.armQueueWaitTimer(session.id, session.visitorLanguage);
            }
            // Same restart-only guard as queueWaitTimers above — a rejoin is
            // socket.io reconnect noise, not genuine activity, so this must
            // not reset the abandon countdown on every blip either.
            if (!this.queueAbandonTimers.has(session.id)) {
              this.armQueueAbandonTimer(session.id, session.visitorLanguage);
            }
            if (!this.isBusinessHours()) {
              await this.fireQueueContactOffer(session.id, session.visitorLanguage);
            }
          }
          this.emitCloseConfirmMessage(session.id, session.visitorLanguage);
          this.emitQueueCloseConfirmMessage(session.id, session.visitorLanguage);
        } else {
          // Rejoining a session that's already closed (e.g. the visitor
          // reloaded the page right after closing) — give the widget the
          // Ended-screen text too, not just the close-popup text.
          this.emitSessionEndedMessage(session.id, session.visitorLanguage);
        }
      }
    } catch (err) {
      this.logger.error('visitor:rejoin failed', err);
    }
  }

  // ── DM: open / join a thread with another operator ────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.DM_OPEN)
  async handleDmOpen(
    @MessageBody() payload: { toOperatorId: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // fromOperatorId is always the verified caller, never a client-supplied
      // value — otherwise any operator could open (and read the history of)
      // a DM thread impersonating someone else entirely.
      const fromOperatorId = client.data.user!.userId;
      const thread = await this.dmService.getOrCreateThread(fromOperatorId, payload.toOperatorId);
      client.join(`dm:${thread.id}`);

      const recipientEntry = this.onlineOperators.get(payload.toOperatorId);
      if (recipientEntry) {
        // this.server is typed as Server but is the /chat Namespace at runtime
        const recipientSocket = (this.server as any).sockets.get(recipientEntry.socketId) as
          | Socket
          | undefined;
        recipientSocket?.join(`dm:${thread.id}`);
      }

      const messages = await this.dmService.getThreadMessages(thread.id);
      client.emit(CHAT_EVENTS.DM_OPENED, { thread, messages });
    } catch (err) {
      this.logger.error('dm:open failed', err);
      client.emit(CHAT_EVENTS.DM_ERROR, { message: 'Failed to open DM thread' });
    }
  }

  // ── DM: send a message to another operator ────────────────────
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage(CHAT_EVENTS.DM_MESSAGE)
  async handleDmMessage(
    @MessageBody() payload: DmMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.checkRateLimit(client)) return;
    try {
      const authorId = client.data.user!.userId;
      // The caller must actually be one of this thread's two participants —
      // threadId alone is otherwise enough to read/write into any DM.
      const isParticipant = await this.dmService.isThreadParticipant(payload.threadId, authorId);
      if (!isParticipant) {
        client.emit(CHAT_EVENTS.DM_ERROR, { message: 'Not a participant in this thread' });
        return;
      }
      const message = await this.dmService.saveMessage(payload.threadId, authorId, payload.body);
      this.server.to(`dm:${payload.threadId}`).emit(CHAT_EVENTS.DM_NEW_MESSAGE, message);
    } catch (err) {
      this.logger.error('dm:message failed', err);
    }
  }

  // ── DM: typing indicator ──────────────────────────────────────
  @UseGuards(WsAuthGuard)
  @SubscribeMessage(CHAT_EVENTS.DM_TYPING)
  handleDmTyping(
    @MessageBody() payload: { threadId: string; typing: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Broadcast to the room but exclude the sender. authorId always comes
    // from the verified identity, never the payload — otherwise any operator
    // could make the "X is typing…" indicator show up as someone else.
    client.to(`dm:${payload.threadId}`).emit(CHAT_EVENTS.DM_TYPING, {
      threadId: payload.threadId,
      authorId: client.data.user!.userId,
      typing: payload.typing,
    });
  }
}
