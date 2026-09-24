import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ChatService, ChatCloseReason } from './chat.service';

describe('ChatService — operator capacity / waiting queue', () => {
  let service: ChatService;
  let prisma: {
    chatSession: {
      groupBy: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  describe('getActiveCountsByOperators', () => {
    it('returns an empty map and skips the query when no operator ids are given', async () => {
      const result = await service.getActiveCountsByOperators([]);

      expect(result.size).toBe(0);
      expect(prisma.chatSession.groupBy).not.toHaveBeenCalled();
    });

    it('groups open session counts by operatorId', async () => {
      prisma.chatSession.groupBy.mockResolvedValue([
        { operatorId: 1, _count: { _all: 2 } },
        { operatorId: 2, _count: { _all: 3 } },
      ]);

      const result = await service.getActiveCountsByOperators([1, 2, 3]);

      expect(prisma.chatSession.groupBy).toHaveBeenCalledWith({
        by: ['operatorId'],
        where: { status: 'open', operatorId: { in: [1, 2, 3] } },
        _count: { _all: true },
      });
      expect(result.get(1)).toBe(2);
      expect(result.get(2)).toBe(3);
      expect(result.get(3)).toBeUndefined();
    });

    it('ignores rows with a null operatorId', async () => {
      prisma.chatSession.groupBy.mockResolvedValue([{ operatorId: null, _count: { _all: 5 } }]);

      const result = await service.getActiveCountsByOperators([1]);

      expect(result.size).toBe(0);
    });
  });

  describe('getActiveSessionCount', () => {
    it('counts only open sessions for the given operator', async () => {
      prisma.chatSession.count.mockResolvedValue(2);

      const result = await service.getActiveSessionCount(1);

      expect(prisma.chatSession.count).toHaveBeenCalledWith({
        where: { status: 'open', operatorId: 1 },
      });
      expect(result).toBe(2);
    });
  });

  describe('getNextQueuedSession', () => {
    it('finds the oldest unassigned open session', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({ id: 'session-1' });

      const result = await service.getNextQueuedSession();

      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'open', operatorId: null },
          orderBy: { startedAt: 'asc' },
        }),
      );
      expect(result).toEqual({ id: 'session-1' });
    });

    it('returns null when the queue is empty', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      const result = await service.getNextQueuedSession();

      expect(result).toBeNull();
    });
  });
});

describe('ChatService — closeSessionWithResolution (fixed 3-reason enum)', () => {
  let service: ChatService;
  let prisma: {
    chatSession: { update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      chatSession: { update: jest.fn().mockResolvedValue({ id: 'session-1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  it('passes the given resolutionTag, regionId, and programId through', async () => {
    await service.closeSessionWithResolution('session-1', 7, ChatCloseReason.OPERATOR_CLOSED, {
      closureSummary: 'Helped the visitor',
      regionId: 'region-1',
      programId: 'program-1',
    });

    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          resolutionTag: ChatCloseReason.OPERATOR_CLOSED,
          closureSummary: 'Helped the visitor',
          regionId: 'region-1',
          programId: 'program-1',
          closedByOperatorId: 7,
        }),
      }),
    );
  });

  it('still works when regionId/programId/dto are omitted', async () => {
    await service.closeSessionWithResolution('session-1', 7, ChatCloseReason.OPERATOR_CLOSED);

    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ regionId: undefined, programId: undefined }),
      }),
    );
  });

  it('accepts a null operatorId for system-triggered closes (e.g. inactivity auto-close)', async () => {
    await service.closeSessionWithResolution('session-1', null, ChatCloseReason.INACTIVITY_TIMEOUT);

    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closedByOperatorId: null }) }),
    );
  });

  it('sets resolutionTag to the visitor-close reason when the visitor closes their own chat', async () => {
    await service.closeSessionWithResolution('session-1', null, ChatCloseReason.CLIENT_CLOSED);

    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolutionTag: ChatCloseReason.CLIENT_CLOSED }),
      }),
    );
  });
});

describe('ChatService — getSession (OPERATOR_SELECT scope)', () => {
  let service: ChatService;
  let prisma: { chatSession: { findUnique: jest.Mock } };

  // The exact shape OPERATOR_SELECT (chat-select.constants.ts) must stay
  // locked to — any widening here (e.g. adding `email`) would leak it into
  // every session payload returned to visitors and other operators.
  const OPERATOR_SHAPE = { id: true, displayName: true, avatarMediaId: true } as const;

  beforeEach(async () => {
    prisma = { chatSession: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  it('requests only {id, displayName, avatarMediaId} for the assigned operator — no email/phone', async () => {
    prisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      operator: { id: 7, displayName: 'Ana Operator', avatarMediaId: null },
      closedByOperator: null,
      knownUser: null,
    });

    await service.getSession('session-1');

    const call = prisma.chatSession.findUnique.mock.calls[0][0];
    expect(call.include.operator.select).toEqual(OPERATOR_SHAPE);
    expect(Object.keys(call.include.operator.select).sort()).toEqual(
      ['avatarMediaId', 'id', 'displayName'].sort(),
    );
    expect(call.include.operator.select).not.toHaveProperty('email');
    expect(call.include.operator.select).not.toHaveProperty('phone');
  });

  it('requests the identical minimal shape for closedByOperator', async () => {
    prisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      operator: null,
      closedByOperator: { id: 3, displayName: 'Supervisor', avatarMediaId: null },
      knownUser: null,
    });

    await service.getSession('session-1');

    const call = prisma.chatSession.findUnique.mock.calls[0][0];
    expect(call.include.closedByOperator.select).toEqual(OPERATOR_SHAPE);
    expect(call.include.closedByOperator.select).not.toHaveProperty('email');
  });

  it('the resolved payload exposes only {id, displayName, avatarMediaId} on operator, even though the underlying User record also has email/password/refreshToken', async () => {
    // Models what Prisma actually returns once OPERATOR_SELECT is honored —
    // the mock intentionally omits email/password/etc. here because that is
    // precisely what the select clause above guarantees never comes back,
    // not something the service code filters after the fact.
    prisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      operator: { id: 7, displayName: 'Ana Operator', avatarMediaId: 12 },
      closedByOperator: null,
      knownUser: null,
    });

    const result = await service.getSession('session-1');

    expect(result?.operator).toEqual({ id: 7, displayName: 'Ana Operator', avatarMediaId: 12 });
    expect(result?.operator).not.toHaveProperty('email');
    // User has no `phone` field in schema.prisma at all — asserted anyway as
    // a forward guard in case one is ever added without updating this select.
    expect(result?.operator).not.toHaveProperty('phone');
    expect(Object.keys(result?.operator ?? {}).sort()).toEqual(
      ['avatarMediaId', 'id', 'displayName'].sort(),
    );
  });

  it('does not include operator at all when the session is unassigned', async () => {
    prisma.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      operator: null,
      closedByOperator: null,
      knownUser: null,
    });

    const result = await service.getSession('session-1');

    expect(result?.operator).toBeNull();
  });
});

describe('ChatService — visitor-facing PII exposure', () => {
  let service: ChatService;
  let prisma: { chatSession: { findMany: jest.Mock } };

  // Same locked shape as the getSession describe block above — repeated here
  // (rather than imported) because OPERATOR_SELECT is a module-private
  // const in chat-select.constants.ts, not exported; the only way to pin its
  // shape from a test is via the arguments it produces on the mocked Prisma
  // calls that use it.
  const OPERATOR_SHAPE = { id: true, displayName: true, avatarMediaId: true } as const;

  beforeEach(async () => {
    prisma = { chatSession: { findMany: jest.fn().mockResolvedValue([]) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  it('OPERATOR_SELECT is exactly {id, displayName, avatarMediaId} — no email, phone, or other User field', async () => {
    await service.getVisitorHistory('visitor@example.com');

    const call = prisma.chatSession.findMany.mock.calls[0][0];
    const operatorSelect = call.include.operator.select;

    expect(operatorSelect).toEqual(OPERATOR_SHAPE);
    expect(Object.keys(operatorSelect).sort()).toEqual(
      ['avatarMediaId', 'id', 'displayName'].sort(),
    );
    expect(operatorSelect).not.toHaveProperty('email');
    expect(operatorSelect).not.toHaveProperty('phone');
    expect(operatorSelect).not.toHaveProperty('password');
    expect(operatorSelect).not.toHaveProperty('refreshToken');
  });

  it('getVisitorHistory (visitor-facing session history) uses OPERATOR_SELECT for the operator relation, not a broader select', async () => {
    await service.getVisitorHistory('visitor@example.com', 'exclude-me');

    expect(prisma.chatSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visitorEmail: 'visitor@example.com',
          status: 'closed',
          // Soft-deleted sessions must not resurface in visitor-facing
          // history — asserted here so the filter can't be dropped silently.
          deletedAt: null,
          id: { not: 'exclude-me' },
        },
        include: expect.objectContaining({
          operator: { select: OPERATOR_SHAPE },
        }),
      }),
    );
  });

  it('the visitor history payload never surfaces operator email/phone even when the underlying User row has them', async () => {
    // As in the getSession block above: this model reflects what Prisma
    // actually returns once the select clause is honored, not a value the
    // service code strips after fetching — there is no post-fetch
    // sanitization step in getVisitorHistory to test around.
    prisma.chatSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        operator: { id: 7, displayName: 'Ana Operator', avatarMediaId: 12 },
        messages: [{ id: 'm-1' }],
      },
    ]);

    const [session] = await service.getVisitorHistory('visitor@example.com');

    expect(session.operator).toEqual({ id: 7, displayName: 'Ana Operator', avatarMediaId: 12 });
    expect(session.operator).not.toHaveProperty('email');
    expect(session.operator).not.toHaveProperty('phone');
  });

  it('excludes the current session by id when excludeSessionId is provided, includes it (no filter) when omitted', async () => {
    await service.getVisitorHistory('visitor@example.com');
    expect(prisma.chatSession.findMany.mock.calls[0][0].where).not.toHaveProperty('id');

    await service.getVisitorHistory('visitor@example.com', 'session-1');
    expect(prisma.chatSession.findMany.mock.calls[1][0].where.id).toEqual({ not: 'session-1' });
  });
});

describe('ChatService — getOperators (supervisor exclusion)', () => {
  let service: ChatService;
  let prisma: {
    user: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  it('excludes a user who holds the operator role but also supervisor (chat.close) permissions', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 1, displayName: 'Regular Operator', avatarMediaId: null },
      { id: 2, displayName: 'Dual-Role Supervisor', avatarMediaId: null },
    ]);
    // isOperatorSupervisor's own query (prisma.user.count) — true for id 2 only.
    prisma.user.count.mockImplementation(({ where }: { where: { id: number } }) =>
      Promise.resolve(where.id === 2 ? 1 : 0),
    );

    const result = await service.getOperators(99);

    expect(result).toEqual([{ id: 1, displayName: 'Regular Operator', avatarMediaId: null }]);
  });

  it('still filters by the operator role slug at the query level', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.getOperators(99);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { role: { slug: 'operator' } } },
        }),
      }),
    );
  });
});

// getSessionMessages' includeInternal flag is the fix for a real leak:
// operator-only internal notes used to be sent straight to the visitor's own
// socket via visitor:rejoin (chat.gateway.ts) because this method had no
// isInternal filter at all. These tests pin the query-level behavior so a
// future change to this method can't silently reintroduce that leak.
describe('ChatService — getSessionMessages internal-note filtering', () => {
  let service: ChatService;
  let prisma: {
    $transaction: jest.Mock;
    chatMessage: { count: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockResolvedValue([0, []]),
      chatMessage: { count: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  it('excludes internal notes from the where clause when includeInternal is false', async () => {
    await service.getSessionMessages('session-1', false);

    expect(prisma.chatMessage.count).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', isInternal: false },
    });
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'session-1', isInternal: false },
      }),
    );
  });

  it('includes internal notes when includeInternal is true', async () => {
    await service.getSessionMessages('session-1', true);

    expect(prisma.chatMessage.count).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
    });
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'session-1' },
      }),
    );
  });
});
