import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProgramsService } from './programs.service';

describe('ProgramsService — CRUD', () => {
  let service: ProgramsService;
  let prisma: {
    program: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      program: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgramsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ProgramsService);
  });

  it('getPrograms orders alphabetically by name', async () => {
    prisma.program.findMany.mockResolvedValue([]);

    await service.getPrograms();

    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('createProgram creates with just a name', async () => {
    prisma.program.create.mockResolvedValue({ id: 'p-1', name: 'Export Support' });

    await service.createProgram('Export Support');

    expect(prisma.program.create).toHaveBeenCalledWith({ data: { name: 'Export Support' } });
  });

  it('updateProgram only sends the fields actually provided', async () => {
    prisma.program.update.mockResolvedValue({ id: 'p-1' });

    await service.updateProgram('p-1', { isActive: false });

    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { isActive: false },
    });
  });

  it('deleteProgram deletes by id', async () => {
    prisma.program.delete.mockResolvedValue({ id: 'p-1' });

    await service.deleteProgram('p-1');

    expect(prisma.program.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
  });
});

describe('ProgramsService — getProgramsPaginated', () => {
  let service: ProgramsService;
  let prisma: {
    program: { findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      program: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgramsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ProgramsService);
  });

  it('passes skip/take through and returns items + total', async () => {
    prisma.program.findMany.mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }]);
    prisma.program.count.mockResolvedValue(12);

    const result = await service.getProgramsPaginated(5, 2);

    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null }, skip: 5, take: 2 }),
    );
    expect(result).toEqual({ items: [{ id: 'p-1' }, { id: 'p-2' }], total: 12 });
  });

  it('defaults to skip=0, take=5 when called with no args', async () => {
    prisma.program.findMany.mockResolvedValue([]);
    prisma.program.count.mockResolvedValue(0);

    await service.getProgramsPaginated();

    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 5 }),
    );
  });
});
