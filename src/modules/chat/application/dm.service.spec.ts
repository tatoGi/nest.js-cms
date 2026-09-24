import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { DmService } from './dm.service';

// isThreadParticipant backs chat.gateway.ts's dm:message handler — without
// it, a client-supplied threadId alone would be enough to read/write into
// any operator's DM thread, not just the caller's own (see chat.gateway.ts
// handleDmMessage).
describe('DmService — isThreadParticipant', () => {
  let service: DmService;
  let prisma: { operatorThread: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { operatorThread: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DmService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DmService);
  });

  it('returns false when the thread does not exist', async () => {
    prisma.operatorThread.findUnique.mockResolvedValue(null);

    expect(await service.isThreadParticipant('thread-1', 1)).toBe(false);
  });

  it('returns true when the user is participant1', async () => {
    prisma.operatorThread.findUnique.mockResolvedValue({
      participant1Id: 1,
      participant2Id: 2,
    });

    expect(await service.isThreadParticipant('thread-1', 1)).toBe(true);
  });

  it('returns true when the user is participant2', async () => {
    prisma.operatorThread.findUnique.mockResolvedValue({
      participant1Id: 1,
      participant2Id: 2,
    });

    expect(await service.isThreadParticipant('thread-1', 2)).toBe(true);
  });

  it('returns false when the user is neither participant', async () => {
    prisma.operatorThread.findUnique.mockResolvedValue({
      participant1Id: 1,
      participant2Id: 2,
    });

    expect(await service.isThreadParticipant('thread-1', 99)).toBe(false);
  });
});
