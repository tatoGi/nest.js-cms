import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatController } from './chat.controller';
import { ChatService } from '../application/chat.service';
import { DmService } from '../application/dm.service';
import { ProgramsService } from '../application/programs.service';
import { RegionsService } from '../application/regions.service';
import { CannedResponseService } from '../application/canned-response.service';
import { ChatReportingService } from '../application/chat-reporting.service';
import { ChatGateway } from '../chat.gateway';

describe('ChatController — getDashboard', () => {
  let controller: ChatController;
  let chatService: { getOpenSessions: jest.Mock };
  let chatReportingService: { getQueuedSessionsSummary: jest.Mock; getDailyStats: jest.Mock };
  let chatGateway: { getOnlineOperatorIds: jest.Mock };

  beforeEach(async () => {
    chatService = {
      getOpenSessions: jest.fn().mockResolvedValue({ items: [{ id: 'active-1' }], total: 1 }),
    };
    chatReportingService = {
      getQueuedSessionsSummary: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'queued-1' }], total: 1 }),
      getDailyStats: jest.fn().mockResolvedValue({ completed: 2, abandoned: 1, avgRating: 4.5 }),
    };
    chatGateway = { getOnlineOperatorIds: jest.fn().mockReturnValue([1, 2]) };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ProgramsService, useValue: {} },
        { provide: RegionsService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        { provide: ChatReportingService, useValue: chatReportingService },
        { provide: ChatGateway, useValue: chatGateway },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('composes online operators, active chats, waiting queue, and daily stats', async () => {
    const result = await controller.getDashboard();

    expect(result).toEqual({
      onlineOperators: [1, 2],
      activeChats: { items: [{ id: 'active-1' }], total: 1 },
      waitingQueue: { items: [{ id: 'queued-1' }], total: 1 },
      dailyStats: { completed: 2, abandoned: 1, avgRating: 4.5 },
    });
  });

  it('reads online operators from the gateway getter, not a duplicated source', async () => {
    await controller.getDashboard();

    expect(chatGateway.getOnlineOperatorIds).toHaveBeenCalledTimes(1);
  });

  it('fetches active chats with a higher cap than the default paginated list, assigned-only (so a busy day is not under-reported and the waiting queue is never double-counted as active)', async () => {
    await controller.getDashboard();

    expect(chatService.getOpenSessions).toHaveBeenCalledWith(0, 100, true);
  });
});

describe('ChatController — reports query parsing', () => {
  let controller: ChatController;
  let chatReportingService: {
    getOperatorStats: jest.Mock;
    getOutcomeStats: jest.Mock;
    getRegionProgramReport: jest.Mock;
  };

  beforeEach(async () => {
    chatReportingService = {
      getOperatorStats: jest.fn().mockResolvedValue([]),
      getOutcomeStats: jest.fn().mockResolvedValue({ completed: 0, abandoned: 0, total: 0 }),
      getRegionProgramReport: jest.fn().mockResolvedValue({ byRegion: [], byProgram: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: {} },
        { provide: DmService, useValue: {} },
        { provide: ProgramsService, useValue: {} },
        { provide: RegionsService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        { provide: ChatReportingService, useValue: chatReportingService },
        { provide: ChatGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('passes undefined from/to through to the service when the query params are omitted', async () => {
    await controller.getOperatorStats();

    expect(chatReportingService.getOperatorStats).toHaveBeenCalledWith(undefined, undefined);
  });

  it('parses from/to query strings into Date objects', async () => {
    await controller.getOutcomeStats('2026-06-01', '2026-07-01');

    expect(chatReportingService.getOutcomeStats).toHaveBeenCalledWith(
      new Date('2026-06-01'),
      new Date('2026-07-01'),
    );
  });

  it('getRegionProgramReport also parses from/to the same way', async () => {
    await controller.getRegionProgramReport('2026-06-01');

    expect(chatReportingService.getRegionProgramReport).toHaveBeenCalledWith(
      new Date('2026-06-01'),
      undefined,
    );
  });
});

describe('ChatController — Program CRUD delegation', () => {
  let controller: ChatController;
  let programsService: {
    getPrograms: jest.Mock;
    createProgram: jest.Mock;
    updateProgram: jest.Mock;
    deleteProgram: jest.Mock;
  };

  beforeEach(async () => {
    programsService = {
      getPrograms: jest.fn().mockResolvedValue([]),
      createProgram: jest.fn().mockResolvedValue({ id: 'p-1' }),
      updateProgram: jest.fn().mockResolvedValue({ id: 'p-1' }),
      deleteProgram: jest.fn().mockResolvedValue({ id: 'p-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: {} },
        { provide: DmService, useValue: {} },
        { provide: ProgramsService, useValue: programsService },
        { provide: RegionsService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        { provide: ChatReportingService, useValue: {} },
        { provide: ChatGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('createProgram delegates with just the name', async () => {
    await controller.createProgram({ name: 'Export Support' });

    expect(programsService.createProgram).toHaveBeenCalledWith('Export Support');
  });

  it('updateProgram delegates id + dto as-is', async () => {
    await controller.updateProgram('p-1', { isActive: false });

    expect(programsService.updateProgram).toHaveBeenCalledWith('p-1', { isActive: false });
  });

  it('deleteProgram delegates the id', async () => {
    await controller.deleteProgram('p-1');

    expect(programsService.deleteProgram).toHaveBeenCalledWith('p-1');
  });
});

describe('ChatController — Region CRUD delegation', () => {
  let controller: ChatController;
  let regionsService: {
    getRegions: jest.Mock;
    createRegion: jest.Mock;
    updateRegion: jest.Mock;
    deleteRegion: jest.Mock;
  };

  beforeEach(async () => {
    regionsService = {
      getRegions: jest.fn().mockResolvedValue([]),
      createRegion: jest.fn().mockResolvedValue({ id: 'r-1' }),
      updateRegion: jest.fn().mockResolvedValue({ id: 'r-1' }),
      deleteRegion: jest.fn().mockResolvedValue({ id: 'r-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: {} },
        { provide: DmService, useValue: {} },
        { provide: ProgramsService, useValue: {} },
        { provide: RegionsService, useValue: regionsService },
        { provide: CannedResponseService, useValue: {} },
        { provide: ChatReportingService, useValue: {} },
        { provide: ChatGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('createRegion delegates with just the name', async () => {
    await controller.createRegion({ name: 'Tbilisi' });

    expect(regionsService.createRegion).toHaveBeenCalledWith('Tbilisi');
  });

  it('updateRegion delegates id + dto as-is', async () => {
    await controller.updateRegion('r-1', { isActive: false });

    expect(regionsService.updateRegion).toHaveBeenCalledWith('r-1', { isActive: false });
  });

  it('deleteRegion delegates the id', async () => {
    await controller.deleteRegion('r-1');

    expect(regionsService.deleteRegion).toHaveBeenCalledWith('r-1');
  });
});

describe('ChatController — updateSessionDetails delegation', () => {
  let controller: ChatController;
  let chatService: { updateSessionDetails: jest.Mock };

  beforeEach(async () => {
    chatService = {
      updateSessionDetails: jest.fn().mockResolvedValue({ id: 's-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: DmService, useValue: {} },
        { provide: ProgramsService, useValue: {} },
        { provide: RegionsService, useValue: {} },
        { provide: CannedResponseService, useValue: {} },
        { provide: ChatReportingService, useValue: {} },
        { provide: ChatGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('delegates id + dto as-is', async () => {
    const dto = { regionId: 'r-1', programId: 'p-1', closureSummary: 'Note' };
    await controller.updateSessionDetails('s-1', dto);

    expect(chatService.updateSessionDetails).toHaveBeenCalledWith('s-1', dto);
  });
});
