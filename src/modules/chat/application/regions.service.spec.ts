import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RegionsService } from './regions.service';

describe('RegionsService — CRUD', () => {
  let service: RegionsService;
  let prisma: {
    region: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      region: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RegionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(RegionsService);
  });

  it('getRegions orders alphabetically by name', async () => {
    prisma.region.findMany.mockResolvedValue([]);

    await service.getRegions();

    expect(prisma.region.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('createRegion creates with just a name', async () => {
    prisma.region.create.mockResolvedValue({ id: 'r-1', name: 'Tbilisi' });

    await service.createRegion('Tbilisi');

    expect(prisma.region.create).toHaveBeenCalledWith({ data: { name: 'Tbilisi' } });
  });

  it('updateRegion only sends the fields actually provided', async () => {
    prisma.region.update.mockResolvedValue({ id: 'r-1' });

    await service.updateRegion('r-1', { isActive: false });

    expect(prisma.region.update).toHaveBeenCalledWith({
      where: { id: 'r-1' },
      data: { isActive: false },
    });
  });

  it('deleteRegion deletes by id', async () => {
    prisma.region.delete.mockResolvedValue({ id: 'r-1' });

    await service.deleteRegion('r-1');

    expect(prisma.region.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
  });
});

describe('RegionsService — getRegionsPaginated', () => {
  let service: RegionsService;
  let prisma: {
    region: { findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      region: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RegionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(RegionsService);
  });

  it('passes skip/take through and returns items + total', async () => {
    prisma.region.findMany.mockResolvedValue([{ id: 'r-1' }]);
    prisma.region.count.mockResolvedValue(1);

    const result = await service.getRegionsPaginated(0, 5);

    expect(prisma.region.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null }, skip: 0, take: 5 }),
    );
    expect(result).toEqual({ items: [{ id: 'r-1' }], total: 1 });
  });
});
