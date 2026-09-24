import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway, OperatorStatus } from './chat.gateway';
import { ChatService, ChatCloseReason } from './application/chat.service';
import { DmService } from './application/dm.service';
import { ChatMailService } from './application/chat-mail.service';
import { CannedResponseService } from './application/canned-response.service';
import { OperatorRotationService } from './application/operator-rotation.service';
import { AuthService } from '@/modules/auth/auth.service';

interface OperatorPresence {
  socketId: string;
  preference: 'online' | 'away' | 'busy';
}

// Minimal authenticated-socket stand-in — real handlers read
// client.data.user.userId (populated by handleConnection from the verified
// JWT cookie; see ws-auth.guard.spec.ts for guard-level auth tests). Direct
// method calls in this file bypass @UseGuards entirely (guards only run
// through Nest's real message pipeline), so tests that exercise a
// WsAuthGuard-protected handler must supply this themselves.
function mockAuthClient(userId: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `socket-${userId}`,
    emit: jest.fn(),
    join: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    data: { user: { userId, email: `op${userId}@example.com`, roles: [], permissions: [] } },
    ...overrides,
  };
}

// Type-safe view onto the gateway's private internals so tests can exercise
// them directly without weakening the production API.
type GatewayInternals = {
  onlineOperators: Map<number, OperatorPresence>;
  pickAvailableOperator: () => Promise<number | null>;
  tryAssignSession: (sessionId: string) => Promise<void>;
  drainQueue: (operatorId: number) => Promise<void>;
  getEffectiveStatus: (operatorId: number) => Promise<OperatorStatus>;
  broadcastStatus: (operatorId: number) => Promise<void>;
  buildStatusList: () => Promise<Array<{ operatorId: number; status: OperatorStatus }>>;
  handleSetStatus: (
    payload: { status: 'online' | 'away' | 'busy' },
    client: ReturnType<typeof mockAuthClient>,
  ) => Promise<void>;
  handleVisitorStart: (
    dto: Record<string, unknown>,
    client: { join: jest.Mock },
  ) => Promise<{ sessionId: string } | undefined>;
  handleVisitorRejoin: (
    payload: { sessionId: string },
    client: { join: jest.Mock; emit: jest.Mock },
  ) => Promise<void>;
  handleRateSession: (payload: { sessionId: string; rating: number }) => Promise<void>;
  isBusinessHours: () => boolean;
  armInactivityTimer: (sessionId: string, visitorLanguage?: string | null) => Promise<void>;
  clearInactivityTimer: (sessionId: string) => void;
  autoCloseForInactivity: (sessionId: string) => Promise<void>;
  queueAbandonTimers: Map<string, unknown>;
  armQueueAbandonTimer: (sessionId: string, visitorLanguage?: string | null) => void;
  clearQueueAbandonTimer: (sessionId: string) => void;
  fireQueueAbandonWarning: (sessionId: string, body: string) => Promise<void>;
  autoCloseForQueueAbandonment: (sessionId: string) => Promise<void>;
  handleVisitorMessage: (
    payload: { sessionId: string; body: string },
    client: { id: string },
  ) => Promise<void>;
  handleVisitorFormActivity: (payload: { sessionId: string }) => Promise<void>;
  handleConnection: (client: {
    handshake: { headers: { cookie?: string } };
    data: Record<string, unknown>;
  }) => Promise<void>;
  handleDisconnect: (client: { id: string }) => void;
  handleOperatorJoin: (
    payload: { operatorId?: number },
    client: ReturnType<typeof mockAuthClient>,
  ) => Promise<void>;
  server: { to: jest.Mock; sockets: Map<string, unknown> };
};

// Matches ChatGateway.OPERATOR_DISCONNECT_GRACE_MS.
const OPERATOR_DISCONNECT_GRACE_MS = 10 * 60 * 1000;

// Matches AUTO_MESSAGE_DEFAULTS.inactivity_warning/inactivity_close.delaySeconds
// (300s each) — the gateway computes the actual timer delay from these at
// arm-time, there's no standalone constant on the class itself.
const INACTIVITY_WARNING_MS = 300_000;
const INACTIVITY_CLOSE_MS = 300_000;

describe('ChatGateway — operator capacity / waiting queue', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: {
    getActiveCountsByOperators: jest.Mock;
    getActiveSessionCount: jest.Mock;
    getNextQueuedSession: jest.Mock;
    assignOperator: jest.Mock;
    saveMessage: jest.Mock;
    getVisitorLanguage: jest.Mock;
    isOperatorSupervisor: jest.Mock;
  };
  let operatorRotation: { pickNext: jest.Mock; sync: jest.Mock; getQueueOrder: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let authService: { validateUser: jest.Mock };

  beforeEach(async () => {
    chatService = {
      getActiveCountsByOperators: jest.fn(),
      getActiveSessionCount: jest.fn().mockResolvedValue(0),
      getNextQueuedSession: jest.fn(),
      assignOperator: jest.fn(),
      // notifyAssignment (called by both tryAssignSession and drainQueue)
      // now sends the greeting itself on every pending → active transition,
      // and arms the inactivity timer — which falls back to this when the
      // mocked session (unlike a real Prisma row) has no visitorLanguage.
      saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      getVisitorLanguage: jest.fn().mockResolvedValue(null),
      isOperatorSupervisor: jest.fn().mockResolvedValue(false),
    };
    operatorRotation = {
      pickNext: jest.fn(),
      sync: jest.fn(),
      getQueueOrder: jest.fn().mockResolvedValue([]),
    };
    jwtService = { verify: jest.fn() };
    authService = { validateUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        { provide: OperatorRotationService, useValue: operatorRotation },
        { provide: JwtService, useValue: jwtService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;

    // Stub the Socket.IO server so notifyAssignment's emits don't throw —
    // @WebSocketServer() is only populated by Nest's real WS adapter.
    internals.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      sockets: new Map(),
    };
  });

  describe('pickAvailableOperator', () => {
    it('returns null when no operators are online', async () => {
      const result = await internals.pickAvailableOperator();

      expect(result).toBeNull();
      expect(chatService.getActiveCountsByOperators).not.toHaveBeenCalled();
      expect(operatorRotation.pickNext).not.toHaveBeenCalled();
    });

    // Selection itself (who wins among eligible/under-capacity operators) is
    // OperatorRotationService's job now — see operator-rotation.service.spec.ts
    // for the actual rotation algorithm. This just verifies pickAvailableOperator
    // wires eligibility + capacity through to it correctly.
    it('delegates to operatorRotation.pickNext with eligible ids and under-capacity ids', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      internals.onlineOperators.set(2, { socketId: 'socket-2', preference: 'online' });
      chatService.getActiveCountsByOperators.mockResolvedValue(
        new Map([
          [1, 3], // at capacity (maxActiveChats defaults to 3)
          [2, 0],
        ]),
      );
      operatorRotation.pickNext.mockResolvedValue(2);

      const result = await internals.pickAvailableOperator();

      expect(result).toBe(2);
      expect(operatorRotation.pickNext).toHaveBeenCalledWith([1, 2], new Set([2]));
    });

    it('returns whatever operatorRotation.pickNext returns, including null when everyone is at capacity', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveCountsByOperators.mockResolvedValue(new Map([[1, 3]]));
      operatorRotation.pickNext.mockResolvedValue(null);

      const result = await internals.pickAvailableOperator();

      expect(result).toBeNull();
      expect(operatorRotation.pickNext).toHaveBeenCalledWith([1], new Set());
    });

    it('excludes operators whose preference is away, even if they are under capacity', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'away' });
      internals.onlineOperators.set(2, { socketId: 'socket-2', preference: 'online' });
      chatService.getActiveCountsByOperators.mockResolvedValue(new Map());
      operatorRotation.pickNext.mockResolvedValue(2);

      const result = await internals.pickAvailableOperator();

      expect(result).toBe(2);
      // Only the non-away operator id should ever reach the counts query
      // or the rotation pick.
      expect(chatService.getActiveCountsByOperators).toHaveBeenCalledWith([2]);
      expect(operatorRotation.pickNext).toHaveBeenCalledWith([2], new Set([2]));
    });

    it('returns null when every online operator is away', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'away' });

      const result = await internals.pickAvailableOperator();

      expect(result).toBeNull();
      expect(chatService.getActiveCountsByOperators).not.toHaveBeenCalled();
      expect(operatorRotation.pickNext).not.toHaveBeenCalled();
    });
  });

  describe('tryAssignSession', () => {
    it('does nothing when no operator has capacity', async () => {
      await internals.tryAssignSession('session-1');

      expect(chatService.assignOperator).not.toHaveBeenCalled();
    });

    it('assigns the session to the picked operator', async () => {
      internals.onlineOperators.set(5, { socketId: 'socket-5', preference: 'online' });
      chatService.getActiveCountsByOperators.mockResolvedValue(new Map());
      operatorRotation.pickNext.mockResolvedValue(5);
      chatService.assignOperator.mockResolvedValue({ id: 'session-1', operatorId: 5 });

      await internals.tryAssignSession('session-1');

      expect(chatService.assignOperator).toHaveBeenCalledWith('session-1', 5);
    });
  });

  describe('drainQueue', () => {
    it('does not query the queue when the operator is already at capacity', async () => {
      chatService.getActiveSessionCount.mockResolvedValue(3);

      await internals.drainQueue(9);

      expect(chatService.getNextQueuedSession).not.toHaveBeenCalled();
      expect(chatService.assignOperator).not.toHaveBeenCalled();
    });

    it('pulls queued sessions until the queue is empty (capacity not yet reached)', async () => {
      chatService.getActiveSessionCount.mockResolvedValue(0);
      chatService.getNextQueuedSession
        .mockResolvedValueOnce({ id: 'queued-1', operatorId: null })
        .mockResolvedValueOnce(null);
      chatService.assignOperator.mockResolvedValue({ id: 'queued-1', operatorId: 9 });

      await internals.drainQueue(9);

      expect(chatService.getNextQueuedSession).toHaveBeenCalledTimes(2);
      expect(chatService.assignOperator).toHaveBeenCalledTimes(1);
      expect(chatService.assignOperator).toHaveBeenCalledWith('queued-1', 9);
    });

    it('stops pulling once the operator reaches capacity, even if the queue still has items', async () => {
      chatService.getActiveSessionCount.mockResolvedValue(2);
      chatService.getNextQueuedSession.mockResolvedValueOnce({
        id: 'queued-1',
        operatorId: null,
      });
      chatService.assignOperator.mockResolvedValue({ id: 'queued-1', operatorId: 9 });

      await internals.drainQueue(9);

      expect(chatService.getNextQueuedSession).toHaveBeenCalledTimes(1);
      expect(chatService.assignOperator).toHaveBeenCalledTimes(1);
    });

    it('does not pull anything for an operator whose preference is away', async () => {
      internals.onlineOperators.set(9, { socketId: 'socket-9', preference: 'away' });

      await internals.drainQueue(9);

      expect(chatService.getActiveSessionCount).not.toHaveBeenCalled();
      expect(chatService.getNextQueuedSession).not.toHaveBeenCalled();
    });
  });

  describe('getOnlineOperatorIds', () => {
    it('returns an empty array when no operators are online', () => {
      expect(gateway.getOnlineOperatorIds()).toEqual([]);
    });

    it('returns the ids of every currently-connected operator', () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      internals.onlineOperators.set(2, { socketId: 'socket-2', preference: 'away' });

      const result = gateway.getOnlineOperatorIds();

      expect(result).toEqual(expect.arrayContaining([1, 2]));
      expect(result).toHaveLength(2);
    });
  });
});

describe('ChatGateway — operator status (Online/Away/Busy/Offline)', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: { getActiveSessionCount: jest.Mock; isOperatorSupervisor: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let authService: { validateUser: jest.Mock };

  beforeEach(async () => {
    chatService = {
      getActiveSessionCount: jest.fn().mockResolvedValue(0),
      // drainQueue (called at the end of handleOperatorJoin) short-circuits
      // once it sees a supervisor, keeping these tests from needing to also
      // mock getNextQueuedSession/assignOperator — irrelevant to what's
      // being tested here (presence/status bookkeeping, not queue draining).
      isOperatorSupervisor: jest.fn().mockResolvedValue(true),
    };
    jwtService = { verify: jest.fn() };
    authService = { validateUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: jwtService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;
    internals.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      sockets: new Map(),
    };
  });

  describe('getEffectiveStatus', () => {
    it('returns offline when the operator has no presence entry', async () => {
      const status = await internals.getEffectiveStatus(1);
      expect(status).toBe('offline');
      expect(chatService.getActiveSessionCount).not.toHaveBeenCalled();
    });

    it('returns busy when active count is at or above MAX_ACTIVE_CHATS, regardless of preference', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveSessionCount.mockResolvedValue(3);

      expect(await internals.getEffectiveStatus(1)).toBe('busy');
    });

    it('returns the stored preference (online) when under capacity', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveSessionCount.mockResolvedValue(1);

      expect(await internals.getEffectiveStatus(1)).toBe('online');
    });

    it('returns the stored preference (away) when under capacity', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'away' });
      chatService.getActiveSessionCount.mockResolvedValue(1);

      expect(await internals.getEffectiveStatus(1)).toBe('away');
    });

    it('busy overrides an away preference once the operator hits capacity', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'away' });
      chatService.getActiveSessionCount.mockResolvedValue(3);

      expect(await internals.getEffectiveStatus(1)).toBe('busy');
    });
  });

  describe('broadcastStatus', () => {
    it('emits operator:status_changed with the effective status', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveSessionCount.mockResolvedValue(0);
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });

      await internals.broadcastStatus(1);

      expect(internals.server.to).toHaveBeenCalledWith('operators');
      expect(emit).toHaveBeenCalledWith('operator:status_changed', {
        operatorId: 1,
        status: 'online',
      });
    });
  });

  describe('buildStatusList', () => {
    it('returns effective status for every currently-online operator', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      internals.onlineOperators.set(2, { socketId: 'socket-2', preference: 'away' });
      chatService.getActiveSessionCount.mockResolvedValue(0);

      const list = await internals.buildStatusList();

      expect(list).toEqual(
        expect.arrayContaining([
          { operatorId: 1, status: 'online' },
          { operatorId: 2, status: 'away' },
        ]),
      );
    });

    it('returns an empty list when no operators are online', async () => {
      const list = await internals.buildStatusList();
      expect(list).toEqual([]);
    });
  });

  describe('handleSetStatus', () => {
    it('updates the preference to away and broadcasts the new effective status', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveSessionCount.mockResolvedValue(0);
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });
      const client = mockAuthClient(1);

      await internals.handleSetStatus({ status: 'away' }, client);

      expect(internals.onlineOperators.get(1)?.preference).toBe('away');
      expect(emit).toHaveBeenCalledWith('operator:status_changed', {
        operatorId: 1,
        status: 'away',
      });
    });

    it('accepts a client-requested "busy" status and applies it', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      chatService.getActiveSessionCount.mockResolvedValue(0);
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });
      const client = mockAuthClient(1);

      await internals.handleSetStatus({ status: 'busy' }, client);

      expect(internals.onlineOperators.get(1)?.preference).toBe('busy');
      expect(emit).toHaveBeenCalledWith('operator:status_changed', {
        operatorId: 1,
        status: 'busy',
      });
    });

    it('rejects a client-requested "offline" status rather than applying it', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      const client = mockAuthClient(1);

      await internals.handleSetStatus(
        { status: 'offline' as unknown as 'online' | 'away' },
        client,
      );

      expect(internals.onlineOperators.get(1)?.preference).toBe('online');
      expect(client.emit).toHaveBeenCalledWith('chat:permission_error', expect.anything());
    });

    it('is a no-op when the operator is not currently connected', async () => {
      const client = mockAuthClient(999);

      await internals.handleSetStatus({ status: 'away' }, client);

      expect(internals.onlineOperators.has(999)).toBe(false);
      expect(client.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('leaves client.data.user unset when there is no accessToken cookie', async () => {
      const client = { handshake: { headers: {} }, data: {} };
      await internals.handleConnection(client);
      expect(client.data).toEqual({});
    });

    it('leaves client.data.user unset when the JWT is invalid/expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const client = {
        handshake: { headers: { cookie: 'accessToken=bad.token.here' } },
        data: {},
      };
      await internals.handleConnection(client);
      expect(client.data).toEqual({});
    });

    it('populates client.data.user from a valid cookie', async () => {
      jwtService.verify.mockReturnValue({ userId: 7 });
      authService.validateUser.mockResolvedValue({
        userId: 7,
        email: 'op@example.com',
        roles: ['operator'],
        permissions: ['chat.reply'],
      });
      const client = {
        handshake: { headers: { cookie: 'other=1; accessToken=good.token.here; foo=bar' } },
        data: {},
      };
      await internals.handleConnection(client);
      expect((client.data as { user?: { userId: number } }).user?.userId).toBe(7);
    });

    it('leaves client.data.user unset when validateUser returns null (deactivated user)', async () => {
      jwtService.verify.mockReturnValue({ userId: 7 });
      authService.validateUser.mockResolvedValue(null);
      const client = {
        handshake: { headers: { cookie: 'accessToken=good.token.here' } },
        data: {},
      };
      await internals.handleConnection(client);
      expect(client.data).toEqual({});
    });
  });

  describe('operator disconnect grace window', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not mark the operator offline immediately on disconnect', () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });

      internals.handleDisconnect({ id: 'socket-1' });

      expect(internals.onlineOperators.has(1)).toBe(true);
      expect(emit).not.toHaveBeenCalledWith('operator:offline', expect.anything());
    });

    it('marks the operator offline once the grace window elapses with no reconnect', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });

      internals.handleDisconnect({ id: 'socket-1' });
      await jest.advanceTimersByTimeAsync(OPERATOR_DISCONNECT_GRACE_MS);

      expect(internals.onlineOperators.has(1)).toBe(false);
      expect(emit).toHaveBeenCalledWith('operator:offline', { operatorId: 1 });
      expect(emit).toHaveBeenCalledWith('operator:status_changed', {
        operatorId: 1,
        status: 'offline',
      });
    });

    it('reconnecting within the grace window cancels the offline timer and never broadcasts offline', async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
      const emit = jest.fn();
      internals.server.to = jest.fn().mockReturnValue({ emit });

      internals.handleDisconnect({ id: 'socket-1' });
      const client = mockAuthClient(1, { id: 'socket-1-new' });
      await internals.handleOperatorJoin({ operatorId: 1 }, client);

      await jest.advanceTimersByTimeAsync(OPERATOR_DISCONNECT_GRACE_MS);

      expect(internals.onlineOperators.get(1)?.socketId).toBe('socket-1-new');
      expect(emit).not.toHaveBeenCalledWith('operator:offline', expect.anything());
    });

    it("a reconnect preserves the operator's prior away/busy preference instead of resetting to online", async () => {
      internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'busy' });

      internals.handleDisconnect({ id: 'socket-1' });
      const client = mockAuthClient(1, { id: 'socket-1-new' });
      await internals.handleOperatorJoin({ operatorId: 1 }, client);

      expect(internals.onlineOperators.get(1)?.preference).toBe('busy');
    });

    it('a genuinely fresh join (no prior entry) still defaults to online', async () => {
      const client = mockAuthClient(42, { id: 'socket-42' });

      await internals.handleOperatorJoin({ operatorId: 42 }, client);

      expect(internals.onlineOperators.get(42)?.preference).toBe('online');
    });
  });
});

// getClientIp reads client.handshake off the socket — real Socket.IO clients
// always have this, but the lightweight { join: jest.fn() } mocks used below
// don't, so give them a minimal handshake shape.
const mockClient = () => ({
  join: jest.fn(),
  handshake: { headers: {}, address: '127.0.0.1' },
});

describe('ChatGateway — handleVisitorStart / no-operators-online broadcast', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: {
    startSession: jest.Mock;
    saveMessage: jest.Mock;
    getSession: jest.Mock;
    getActiveCountsByOperators: jest.Mock;
    getVisitorLanguage: jest.Mock;
    isOperatorSupervisor: jest.Mock;
  };
  let mailService: { sendNoOperatorAvailableNotice: jest.Mock };

  beforeEach(async () => {
    chatService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
      saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      getSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', operatorId: null, status: 'open' }),
      isOperatorSupervisor: jest.fn().mockResolvedValue(false),
      getActiveCountsByOperators: jest.fn().mockResolvedValue(new Map()),
      getVisitorLanguage: jest.fn().mockResolvedValue(null),
    };
    mailService = { sendNoOperatorAvailableNotice: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: mailService },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { validateUser: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;
    internals.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      sockets: new Map(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits chat:close_confirm_message to the session room with the default header/body (no cache populated)', async () => {
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    expect(internals.server.to).toHaveBeenCalledWith('session:session-1');
    expect(emit).toHaveBeenCalledWith('chat:close_confirm_message', {
      header: "End this chat? You'll need to start a new conversation.",
      body: 'How was your chat?',
      buttonText: 'Cancel',
      rating: {
        ratePrompt: 'How was your chat?',
        thanksMessage: 'Thanks for your feedback!',
        commentLabel: 'Comment',
        commentPlaceholder: 'Add a comment (optional)',
        submitButton: 'Submit',
      },
    });
  });

  it('does not fire chat:queue_contact_offer when zero operators are connected during business hours (queue_wait covers this instead)', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(true);
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    const contactOfferCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_contact_offer',
    );
    expect(contactOfferCalls).toHaveLength(0);
    expect(mailService.sendNoOperatorAvailableNotice).not.toHaveBeenCalled();
  });

  it('also sends the internal notice email when zero operators are online AND outside business hours', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);

    await internals.handleVisitorStart(
      { visitorName: 'Ana', visitorEmail: 'a@b.com', visitorPhone: '123' },
      mockClient(),
    );

    expect(mailService.sendNoOperatorAvailableNotice).toHaveBeenCalledWith({
      visitorName: 'Ana',
      visitorEmail: 'a@b.com',
      visitorPhone: '123',
    });
  });

  it('does not send the notice email when zero operators are online but it is business hours', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(true);

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    expect(mailService.sendNoOperatorAvailableNotice).not.toHaveBeenCalled();
  });

  it('does not fire chat:queue_contact_offer immediately when at least one operator is connected and it is within business hours, even if all are at capacity', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(true);
    internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
    chatService.getActiveCountsByOperators.mockResolvedValue(new Map([[1, 3]])); // at MAX_ACTIVE_CHATS — stays queued
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    // queue_wait (not queue_contact_offer) covers this business-hours case now.
    const noOperatorsCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_contact_offer',
    );
    expect(noOperatorsCalls).toHaveLength(0);
  });

  it('fires chat:queue_contact_offer immediately outside business hours even when an operator is connected but at capacity', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);
    internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
    chatService.getActiveCountsByOperators.mockResolvedValue(new Map([[1, 3]])); // at MAX_ACTIVE_CHATS — stays queued
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    const noOperatorsCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_contact_offer',
    );
    expect(noOperatorsCalls).toHaveLength(1);
    // Zero operators is false here (one is connected) so the internal email
    // safety-net — which only fires for the "genuinely offline team" case —
    // is not expected.
    expect(mailService.sendNoOperatorAvailableNotice).not.toHaveBeenCalled();
  });

  it('does not fire chat:queue_contact_offer when the session is assigned immediately', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);
    chatService.getSession.mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open' });
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    const noOperatorsCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_contact_offer',
    );
    expect(noOperatorsCalls).toHaveLength(0);
    expect(mailService.sendNoOperatorAvailableNotice).not.toHaveBeenCalled();
  });
});

describe('ChatGateway — inactivity warning / auto-close', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: {
    saveMessage: jest.Mock;
    closeSessionWithResolution: jest.Mock;
    getActiveSessionCount: jest.Mock;
    getNextQueuedSession: jest.Mock;
    assignOperator: jest.Mock;
    getActiveCountsByOperators: jest.Mock;
    getVisitorLanguage: jest.Mock;
    isOperatorSupervisor: jest.Mock;
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    chatService = {
      saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      closeSessionWithResolution: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', operatorId: null }),
      getActiveSessionCount: jest.fn().mockResolvedValue(0),
      getNextQueuedSession: jest.fn().mockResolvedValue(null),
      assignOperator: jest.fn(),
      getActiveCountsByOperators: jest.fn().mockResolvedValue(new Map()),
      isOperatorSupervisor: jest.fn().mockResolvedValue(false),
      getVisitorLanguage: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { validateUser: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;
    internals.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      sockets: new Map(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires the warning after INACTIVITY_WARNING_MS, then auto-closes after INACTIVITY_CLOSE_MS', async () => {
    await internals.armInactivityTimer('session-1');

    await jest.advanceTimersByTimeAsync(INACTIVITY_WARNING_MS);

    expect(chatService.saveMessage).toHaveBeenCalledWith(
      'session-1',
      expect.stringContaining('closed automatically'),
      'operator',
    );
    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(INACTIVITY_CLOSE_MS);

    expect(chatService.closeSessionWithResolution).toHaveBeenCalledWith(
      'session-1',
      null,
      ChatCloseReason.INACTIVITY_TIMEOUT,
    );
  });

  it('autoCloseForInactivity emits chat:session_ended_message with the default header/body', async () => {
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.autoCloseForInactivity('session-1');

    expect(internals.server.to).toHaveBeenCalledWith('session:session-1');
    expect(emit).toHaveBeenCalledWith('chat:session_ended_message', {
      header: 'Chat ended',
      body: 'Thank you. An operator will contact you shortly.',
      buttonText: 'Start New Chat',
    });
  });

  it('re-arming (simulating a new message) before the warning fires prevents it from firing on schedule', async () => {
    await internals.armInactivityTimer('session-1');
    await jest.advanceTimersByTimeAsync(INACTIVITY_WARNING_MS - 1000);

    await internals.armInactivityTimer('session-1'); // e.g. visitor:message / operator:message resets it

    await jest.advanceTimersByTimeAsync(1000);
    expect(chatService.saveMessage).not.toHaveBeenCalled();
  });

  it('clearInactivityTimer prevents the warning and auto-close from ever firing', async () => {
    await internals.armInactivityTimer('session-1');
    internals.clearInactivityTimer('session-1');

    await jest.advanceTimersByTimeAsync(INACTIVITY_WARNING_MS + INACTIVITY_CLOSE_MS);

    expect(chatService.saveMessage).not.toHaveBeenCalled();
    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();
  });

  it('autoCloseForInactivity drains the queue for the now-freed operator', async () => {
    chatService.closeSessionWithResolution.mockResolvedValue({ id: 'session-1', operatorId: 7 });
    chatService.getActiveSessionCount.mockResolvedValue(2);
    chatService.getNextQueuedSession
      .mockResolvedValueOnce({ id: 'queued-1', operatorId: null })
      .mockResolvedValueOnce(null);
    chatService.assignOperator.mockResolvedValue({ id: 'queued-1', operatorId: 7 });

    await internals.autoCloseForInactivity('session-1');

    expect(chatService.assignOperator).toHaveBeenCalledWith('queued-1', 7);
  });

  it('autoCloseForInactivity does not attempt to drain when the session had no assigned operator', async () => {
    chatService.closeSessionWithResolution.mockResolvedValue({ id: 'session-1', operatorId: null });

    await internals.autoCloseForInactivity('session-1');

    expect(chatService.getActiveSessionCount).not.toHaveBeenCalled();
  });
});

describe('ChatGateway — queue abandonment (queued, unassigned) warning / auto-close', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: {
    startSession: jest.Mock;
    saveMessage: jest.Mock;
    getSession: jest.Mock;
    closeSessionWithResolution: jest.Mock;
    getActiveSessionCount: jest.Mock;
    getNextQueuedSession: jest.Mock;
    assignOperator: jest.Mock;
    getActiveCountsByOperators: jest.Mock;
    getVisitorLanguage: jest.Mock;
    isOperatorSupervisor: jest.Mock;
  };
  let mailService: { sendNoOperatorAvailableNotice: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();

    chatService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
      saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      getSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', operatorId: null, status: 'open' }),
      closeSessionWithResolution: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', operatorId: null }),
      getActiveSessionCount: jest.fn().mockResolvedValue(0),
      getNextQueuedSession: jest.fn().mockResolvedValue(null),
      assignOperator: jest.fn(),
      getActiveCountsByOperators: jest.fn().mockResolvedValue(new Map()),
      getVisitorLanguage: jest.fn().mockResolvedValue(null),
      isOperatorSupervisor: jest.fn().mockResolvedValue(false),
    };
    mailService = { sendNoOperatorAvailableNotice: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: mailService },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { validateUser: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;
    internals.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      sockets: new Map(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Matches AUTO_MESSAGE_DEFAULTS.queue_abandon_warning/queue_abandon_close
  // .delaySeconds — deliberately more generous than inactivity's 5+5 (see
  // that constant's comment): during business hours this is the only thing
  // standing between "every operator is briefly busy" and losing a visitor
  // who'd have gladly waited.
  const QUEUE_ABANDON_WARNING_MS = 600_000;
  const QUEUE_ABANDON_CLOSE_MS = 300_000;

  it('fires the warning after QUEUE_ABANDON_WARNING_MS, then auto-closes after QUEUE_ABANDON_CLOSE_MS', async () => {
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    internals.armQueueAbandonTimer('session-1');
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS);

    expect(internals.server.to).toHaveBeenCalledWith('session:session-1');
    expect(emit).toHaveBeenCalledWith('chat:queue_abandon_warning', {
      sessionId: 'session-1',
      message: expect.stringContaining('close soon'),
    });
    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_CLOSE_MS);

    expect(chatService.closeSessionWithResolution).toHaveBeenCalledWith(
      'session-1',
      null,
      ChatCloseReason.INACTIVITY_TIMEOUT,
    );
  });

  it('re-arming (simulating visitor activity while still queued) before the warning fires prevents it from firing on schedule', async () => {
    internals.armQueueAbandonTimer('session-1');
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS - 1000);

    internals.armQueueAbandonTimer('session-1'); // e.g. visitor:message while still queued

    await jest.advanceTimersByTimeAsync(1000);
    expect(chatService.getSession).not.toHaveBeenCalled();
  });

  it('handleVisitorFormActivity re-arms the countdown, same as a real visitor:message, while still queued', async () => {
    internals.armQueueAbandonTimer('session-1');
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS - 1000);

    await internals.handleVisitorFormActivity({ sessionId: 'session-1' });

    await jest.advanceTimersByTimeAsync(1000);
    const emit = (internals.server.to as jest.Mock).mock.results[0]?.value?.emit as
      | jest.Mock
      | undefined;
    expect(emit?.mock.calls ?? []).not.toContainEqual([
      'chat:queue_abandon_warning',
      expect.anything(),
    ]);

    // Confirm it actually still fires later, off the new countdown.
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS - 1000);
    expect(chatService.getSession).toHaveBeenCalled();
  });

  it('handleVisitorFormActivity is a no-op once an operator has joined', async () => {
    chatService.getSession.mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open' });
    internals.armQueueAbandonTimer('session-1');

    await internals.handleVisitorFormActivity({ sessionId: 'session-1' });

    // No new timer armed on top of the existing one — advancing past the
    // original warning delay should still fire exactly once, not be pushed
    // out further by the no-op call.
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS);
    expect(emit).not.toHaveBeenCalledWith('chat:queue_abandon_warning', expect.anything());
  });

  it('clearQueueAbandonTimer prevents the warning and auto-close from ever firing', async () => {
    internals.armQueueAbandonTimer('session-1');
    internals.clearQueueAbandonTimer('session-1');

    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS + QUEUE_ABANDON_CLOSE_MS);

    expect(chatService.getSession).not.toHaveBeenCalled();
    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();
  });

  it('fireQueueAbandonWarning is a no-op if an operator has since joined (race guard)', async () => {
    chatService.getSession.mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open' });
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.fireQueueAbandonWarning('session-1', 'still there?');

    expect(internals.server.to).not.toHaveBeenCalled();
  });

  it('autoCloseForQueueAbandonment is a no-op if an operator has since joined (race guard)', async () => {
    chatService.getSession.mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open' });

    await internals.autoCloseForQueueAbandonment('session-1');

    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();
  });

  it('autoCloseForQueueAbandonment is a no-op if the session is already closed', async () => {
    chatService.getSession.mockResolvedValue({
      id: 'session-1',
      operatorId: null,
      status: 'closed',
    });

    await internals.autoCloseForQueueAbandonment('session-1');

    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();
  });

  it('handleVisitorStart arms the queue-abandon countdown for a session that stays unassigned off-hours', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS);

    const warningCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_abandon_warning',
    );
    expect(warningCalls).toHaveLength(1);
  });

  it('handleVisitorStart arms the queue-abandon countdown for a session that stays unassigned during business hours (all operators busy)', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(true);
    internals.onlineOperators.set(1, { socketId: 'socket-1', preference: 'online' });
    chatService.getActiveCountsByOperators.mockResolvedValue(new Map([[1, 3]])); // at MAX_ACTIVE_CHATS
    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS);

    const warningCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_abandon_warning',
    );
    expect(warningCalls).toHaveLength(1);
  });

  it('does not arm the queue-abandon countdown when the session is assigned immediately', async () => {
    chatService.getSession.mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open' });

    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    expect(internals.queueAbandonTimers.has('session-1')).toBe(false);
  });

  it('an operator joining cancels the queue-abandon countdown — it never fires even after the delay elapses', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);
    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());
    expect(internals.queueAbandonTimers.has('session-1')).toBe(true);

    // Operator picks it up via the normal assignment path — assignOperator's
    // resolved value is what notifyAssignment actually reads (not a fresh
    // getSession call), so that's what needs mocking here.
    internals.onlineOperators.set(7, { socketId: 'socket-7', preference: 'online' });
    chatService.getActiveCountsByOperators.mockResolvedValue(new Map());
    (chatService as unknown as { assignOperator: jest.Mock }).assignOperator = jest
      .fn()
      .mockResolvedValue({ id: 'session-1', operatorId: 7, status: 'open', visitorLanguage: null });
    await internals.tryAssignSession('session-1');

    expect(internals.queueAbandonTimers.has('session-1')).toBe(false);
    // notifyAssignment also arms this session's inactivity timer now that it
    // has an operator (correct, separate, already covered by its own
    // describe block above) — clear it so advancing time below can only
    // demonstrate the queue-abandon countdown staying cancelled, not get a
    // false failure from that unrelated timer completing its own cycle.
    internals.clearInactivityTimer('session-1');

    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });
    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS + QUEUE_ABANDON_CLOSE_MS);

    const warningCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_abandon_warning',
    );
    expect(warningCalls).toHaveLength(0);
    expect(chatService.closeSessionWithResolution).not.toHaveBeenCalled();
  });

  it('a visitor message while still queued restarts the countdown instead of leaving it on the original schedule', async () => {
    internals.isBusinessHours = jest.fn().mockReturnValue(false);
    await internals.handleVisitorStart({ visitorName: 'Ana' }, mockClient());

    // handleVisitorMessage's real implementation chains .to(...).except(...)
    // for the "notify operators not watching this session" broadcast — the
    // suite's default server.to mock only returns {emit}, which throws
    // TypeError on .except and would otherwise make the handler fail
    // silently (caught by its own try/catch) before ever reaching the
    // re-arm this test means to exercise.
    internals.server.to = jest
      .fn()
      .mockReturnValue({ emit: jest.fn(), except: jest.fn().mockReturnValue({ emit: jest.fn() }) });

    await jest.advanceTimersByTimeAsync(QUEUE_ABANDON_WARNING_MS - 1000);
    await internals.handleVisitorMessage(
      { sessionId: 'session-1', body: 'hello?' },
      {
        id: 'socket-1',
      },
    );

    const emit = jest.fn();
    internals.server.to = jest.fn().mockReturnValue({ emit });
    await jest.advanceTimersByTimeAsync(1000);

    const warningCalls = emit.mock.calls.filter(
      ([event]) => event === 'chat:queue_abandon_warning',
    );
    expect(warningCalls).toHaveLength(0);
  });
});

describe('ChatGateway — isBusinessHours', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: {} },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { validateUser: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;

    process.env.BUSINESS_HOURS_TIMEZONE = 'UTC';
    process.env.BUSINESS_HOURS_START = '9';
    process.env.BUSINESS_HOURS_END = '18';
    // Every day of the week — isolates the hour-boundary assertions below
    // from any dependency on which real-world weekday "now" happens to be.
    process.env.BUSINESS_HOURS_DAYS = '0,1,2,3,4,5,6';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('returns true within the configured hour window', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T10:00:00Z'));

    expect(internals.isBusinessHours()).toBe(true);
  });

  it('returns false before the configured start hour', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T05:00:00Z'));

    expect(internals.isBusinessHours()).toBe(false);
  });

  it('returns false at/after the configured end hour (end is exclusive)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T18:00:00Z'));

    expect(internals.isBusinessHours()).toBe(false);
  });

  it('returns false when no configured day matches, regardless of hour', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T10:00:00Z'));
    process.env.BUSINESS_HOURS_DAYS = '';

    expect(internals.isBusinessHours()).toBe(false);
  });
});

describe('ChatGateway — visitor:rate_session', () => {
  let gateway: ChatGateway;
  let internals: GatewayInternals;
  let chatService: { rateSession: jest.Mock };

  beforeEach(async () => {
    chatService = {
      rateSession: jest.fn().mockResolvedValue({ id: 'session-1', visitorRating: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ChatMailService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        {
          provide: OperatorRotationService,
          useValue: {
            // Smart-ish stub, not real rotation math (that's covered in
            // operator-rotation.service.spec.ts): picks the first eligible
            // id that's also under capacity, or null if none are — enough
            // for tests that don't care about rotation order specifically,
            // but still respects the at-capacity case correctly.
            pickNext: jest.fn((eligibleIds: number[], underCapacityIds: Set<number>) =>
              Promise.resolve(eligibleIds.find((id) => underCapacityIds.has(id)) ?? null),
            ),
            sync: jest.fn(),
            getQueueOrder: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthService, useValue: { validateUser: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    internals = gateway as unknown as GatewayInternals;
  });

  it.each([1, 2, 3, 4, 5])('accepts an in-range rating of %i', async (rating) => {
    await internals.handleRateSession({ sessionId: 'session-1', rating });

    expect(chatService.rateSession).toHaveBeenCalledWith('session-1', rating, undefined);
  });

  it.each([0, 6, -1, 3.5])(
    'rejects an out-of-range or non-integer rating of %s',
    async (rating) => {
      await internals.handleRateSession({ sessionId: 'session-1', rating });

      expect(chatService.rateSession).not.toHaveBeenCalled();
    },
  );
});
