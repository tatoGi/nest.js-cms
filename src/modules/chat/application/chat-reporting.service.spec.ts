import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ChatService, ChatCloseReason } from './chat.service';
import { ChatReportingService } from './chat-reporting.service';

describe('ChatReportingService — reporting / dashboard', () => {
  let service: ChatReportingService;
  let prisma: {
    chatSession: {
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      $transaction?: jest.Mock;
    };
    program: { findMany: jest.Mock };
    region: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let chatService: { isOperatorSupervisor: jest.Mock };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      program: { findMany: jest.fn() },
      region: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    // Defaults to "not a supervisor" so existing getOperatorStats
    // expectations (written before the supervisor-exclusion filter existed)
    // keep passing without every test needing to know about it.
    chatService = { isOperatorSupervisor: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatReportingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatService, useValue: chatService },
      ],
    }).compile();

    service = module.get(ChatReportingService);
  });

  describe('getQueuedSessionsSummary', () => {
    it('lists all queued (open + unassigned) sessions oldest-first, plus the total count', async () => {
      prisma.chatSession.findMany.mockResolvedValue([{ id: 'q-1' }]);
      prisma.chatSession.count.mockResolvedValue(1);

      const result = await service.getQueuedSessionsSummary();

      expect(prisma.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'open', operatorId: null },
          orderBy: { startedAt: 'asc' },
        }),
      );
      expect(result).toEqual({ items: [{ id: 'q-1' }], total: 1 });
    });
  });

  describe('getOperatorStats', () => {
    it('computes chats handled, avg duration, avg first-response time, and avg rating per operator', async () => {
      const startedAt = new Date('2026-07-01T10:00:00Z');
      const firstOperatorMsgAt = new Date('2026-07-01T10:05:00Z'); // 5 min first response
      const closedAt = new Date('2026-07-01T10:30:00Z'); // 30 min duration

      prisma.chatSession.findMany.mockResolvedValue([
        {
          operatorId: 1,
          operator: { id: 1, displayName: 'Op One' },
          startedAt,
          closedAt,
          visitorRating: 5,
          messages: [{ createdAt: firstOperatorMsgAt }],
        },
      ]);

      const [stats] = await service.getOperatorStats();

      expect(stats.operatorId).toBe(1);
      expect(stats.operatorName).toBe('Op One');
      expect(stats.chatsHandled).toBe(1);
      expect(stats.avgDurationMs).toBe(closedAt.getTime() - startedAt.getTime());
      expect(stats.avgFirstResponseMs).toBe(firstOperatorMsgAt.getTime() - startedAt.getTime());
      expect(stats.avgRating).toBe(5);
    });

    it('excludes sessions with no assigned operator from the per-operator breakdown', async () => {
      prisma.chatSession.findMany.mockResolvedValue([
        {
          operatorId: null,
          operator: null,
          startedAt: new Date(),
          closedAt: new Date(),
          visitorRating: null,
          messages: [],
        },
      ]);

      const stats = await service.getOperatorStats();

      expect(stats).toEqual([]);
    });

    it('excludes a supervisor from the results even though they personally closed a session', async () => {
      prisma.chatSession.findMany.mockResolvedValue([
        {
          operatorId: 1,
          operator: { id: 1, displayName: 'Supervisor One' },
          startedAt: new Date('2026-07-01T10:00:00Z'),
          closedAt: new Date('2026-07-01T10:10:00Z'),
          visitorRating: null,
          messages: [{ createdAt: new Date('2026-07-01T10:01:00Z') }],
        },
      ]);
      chatService.isOperatorSupervisor.mockResolvedValue(true);

      const stats = await service.getOperatorStats();

      expect(stats).toEqual([]);
      expect(chatService.isOperatorSupervisor).toHaveBeenCalledWith(1);
    });

    it('excludes abandoned sessions (no operator message) from the first-response average, without dropping them from chatsHandled', async () => {
      const startedAt = new Date('2026-07-01T10:00:00Z');
      const closedAt = new Date('2026-07-01T10:10:00Z');

      prisma.chatSession.findMany.mockResolvedValue([
        {
          operatorId: 1,
          operator: { id: 1, displayName: 'Op One' },
          startedAt,
          closedAt,
          visitorRating: null,
          messages: [], // abandoned — no operator ever replied
        },
      ]);

      const [stats] = await service.getOperatorStats();

      expect(stats.chatsHandled).toBe(1);
      expect(stats.avgFirstResponseMs).toBeNull();
      expect(stats.avgRating).toBeNull();
    });

    it('defaults the date range to the trailing 30 days when from/to are omitted', async () => {
      prisma.chatSession.findMany.mockResolvedValue([]);

      await service.getOperatorStats();

      const call = prisma.chatSession.findMany.mock.calls[0][0];
      const { gte, lte } = call.where.closedAt;
      const diffDays = (lte.getTime() - gte.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(30, 0);
    });
  });

  describe('getOutcomeStats', () => {
    it('counts a session as completed when it has at least one operator message', async () => {
      prisma.chatSession.findMany.mockResolvedValue([
        { id: 's-1', resolutionTag: ChatCloseReason.OPERATOR_CLOSED, messages: [{ id: 'm-1' }] },
        { id: 's-2', resolutionTag: ChatCloseReason.INACTIVITY_TIMEOUT, messages: [] },
      ]);

      const result = await service.getOutcomeStats();

      expect(result).toEqual({
        completed: 1,
        abandoned: 1,
        total: 2,
        byCloseReason: {
          [ChatCloseReason.CLIENT_CLOSED]: 0,
          [ChatCloseReason.INACTIVITY_TIMEOUT]: 1,
          [ChatCloseReason.OPERATOR_CLOSED]: 1,
        },
      });
    });

    it('only counts messages from a real operator (authorId set), not automatic system messages', async () => {
      prisma.chatSession.findMany.mockResolvedValue([]);

      await service.getOutcomeStats();

      const call = prisma.chatSession.findMany.mock.calls[0][0];
      // greeting/queue_wait/inactivity_warning/inactivity_close are all
      // saved with role: 'operator' but no authorId — role alone would
      // wrongly count a never-replied-to session as "completed".
      expect(call.select.messages.where).toEqual({
        role: 'operator',
        authorId: { not: null },
      });
    });

    it('does not count legacy resolutionTag values (predating the fixed 3-reason enum)', async () => {
      prisma.chatSession.findMany.mockResolvedValue([
        { id: 's-1', resolutionTag: 'Resolved', messages: [{ id: 'm-1' }] },
      ]);

      const result = await service.getOutcomeStats();

      expect(result.byCloseReason).toEqual({
        [ChatCloseReason.CLIENT_CLOSED]: 0,
        [ChatCloseReason.INACTIVITY_TIMEOUT]: 0,
        [ChatCloseReason.OPERATOR_CLOSED]: 0,
      });
    });
  });

  describe('getDailyStats', () => {
    it('scopes the outcome query to the current day and includes avg rating', async () => {
      prisma.chatSession.findMany
        .mockResolvedValueOnce([{ id: 's-1', messages: [{ id: 'm-1' }] }]) // getOutcomeStats' findMany
        .mockResolvedValueOnce([{ visitorRating: 4 }, { visitorRating: 2 }]); // rated sessions

      const result = await service.getDailyStats();

      expect(result.completed).toBe(1);
      expect(result.abandoned).toBe(0);
      expect(result.avgRating).toBe(3);
    });

    it('returns null avgRating when nothing was rated today', async () => {
      prisma.chatSession.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getDailyStats();

      expect(result.avgRating).toBeNull();
    });
  });

  describe('getRegionProgramReport', () => {
    it('groups by region and by program, resolving region and program names', async () => {
      prisma.chatSession.groupBy
        .mockResolvedValueOnce([
          { regionId: 'r-1', _count: { _all: 3 } },
          { regionId: null, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ programId: 'p-1', _count: { _all: 2 } }]);
      prisma.region.findMany.mockResolvedValue([{ id: 'r-1', name: 'Tbilisi' }]);
      prisma.program.findMany.mockResolvedValue([{ id: 'p-1', name: 'Export Support' }]);

      const result = await service.getRegionProgramReport();

      expect(result.byRegion).toEqual([
        { regionId: 'r-1', region: 'Tbilisi', count: 3 },
        { regionId: null, region: 'Unspecified', count: 1 },
      ]);
      expect(result.byProgram).toEqual([
        { programId: 'p-1', programName: 'Export Support', count: 2 },
      ]);
      expect(prisma.region.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['r-1'] } },
        select: { id: true, name: true },
      });
      expect(prisma.program.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p-1'] } },
        select: { id: true, name: true },
      });
    });

    it('skips the region/program lookups entirely when no session has either set', async () => {
      prisma.chatSession.groupBy
        .mockResolvedValueOnce([{ regionId: null, _count: { _all: 5 } }])
        .mockResolvedValueOnce([{ programId: null, _count: { _all: 5 } }]);

      const result = await service.getRegionProgramReport();

      expect(prisma.region.findMany).not.toHaveBeenCalled();
      expect(prisma.program.findMany).not.toHaveBeenCalled();
      expect(result.byRegion).toEqual([{ regionId: null, region: 'Unspecified', count: 5 }]);
      expect(result.byProgram).toEqual([{ programId: null, programName: 'Unspecified', count: 5 }]);
    });
  });
});
