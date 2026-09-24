import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CannedResponseService } from './canned-response.service';

describe('CannedResponseService — canned responses', () => {
  let service: CannedResponseService;
  let prisma: {
    cannedResponse: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    cannedResponseTranslation: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      cannedResponse: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cannedResponseTranslation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CannedResponseService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CannedResponseService);
  });

  describe('getCannedResponses', () => {
    it('selects categoryId + joined category alongside the existing fields', async () => {
      prisma.cannedResponse.findMany.mockResolvedValue([]);

      await service.getCannedResponses();

      expect(prisma.cannedResponse.findMany).toHaveBeenCalledWith({
        where: { trigger: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          body: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          translations: { include: { language: true } },
        },
      });
    });
  });

  describe('createCannedResponse', () => {
    it('passes categoryId through to the create call', async () => {
      prisma.cannedResponse.create.mockResolvedValue({ id: 'cr-1' });

      await service.createCannedResponse(
        { title: 'Greeting', body: 'Hello!', categoryId: 'cat-1' },
        42,
      );

      expect(prisma.cannedResponse.create).toHaveBeenCalledWith({
        data: { title: 'Greeting', body: 'Hello!', categoryId: 'cat-1', createdById: 42 },
      });
    });

    it('creates without a category when none is provided', async () => {
      prisma.cannedResponse.create.mockResolvedValue({ id: 'cr-2' });

      await service.createCannedResponse({ title: 'Greeting', body: 'Hello!' }, 42);

      expect(prisma.cannedResponse.create).toHaveBeenCalledWith({
        data: { title: 'Greeting', body: 'Hello!', categoryId: undefined, createdById: 42 },
      });
    });
  });

  describe('updateCannedResponse', () => {
    it('only includes fields that were actually provided (partial update)', async () => {
      prisma.cannedResponse.update.mockResolvedValue({ id: 'cr-1' });

      await service.updateCannedResponse('cr-1', { categoryId: 'cat-2' });

      expect(prisma.cannedResponse.update).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: { categoryId: 'cat-2' },
      });
    });

    it('updates title, body, and category together when all are provided', async () => {
      prisma.cannedResponse.update.mockResolvedValue({ id: 'cr-1' });

      await service.updateCannedResponse('cr-1', {
        title: 'New title',
        body: 'New body',
        categoryId: 'cat-3',
      });

      expect(prisma.cannedResponse.update).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: { title: 'New title', body: 'New body', categoryId: 'cat-3' },
      });
    });

    it('sends an empty data object when no fields are provided', async () => {
      prisma.cannedResponse.update.mockResolvedValue({ id: 'cr-1' });

      await service.updateCannedResponse('cr-1', {});

      expect(prisma.cannedResponse.update).toHaveBeenCalledWith({
        where: { id: 'cr-1' },
        data: {},
      });
    });
  });
});

describe('CannedResponseService — upsertAutoMessage (header requirement)', () => {
  let service: CannedResponseService;
  let prisma: {
    cannedResponse: { upsert: jest.Mock };
    cannedResponseTranslation: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      cannedResponse: { upsert: jest.fn().mockResolvedValue({ id: 'cr-1' }) },
      cannedResponseTranslation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CannedResponseService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CannedResponseService);
  });

  it('rejects close_confirm with a missing header', async () => {
    await expect(
      service.upsertAutoMessage('close_confirm', { body: 'How was your chat?' }, 1),
    ).rejects.toThrow('Header is required for this trigger.');

    expect(prisma.cannedResponse.upsert).not.toHaveBeenCalled();
  });

  it('rejects close_confirm with a blank/whitespace-only header', async () => {
    await expect(
      service.upsertAutoMessage('close_confirm', { body: 'How was your chat?', header: '   ' }, 1),
    ).rejects.toThrow('Header is required for this trigger.');
  });

  it('accepts close_confirm with a header provided', async () => {
    const result = await service.upsertAutoMessage(
      'close_confirm',
      { body: 'How was your chat?', header: 'End this chat?' },
      1,
    );

    expect(prisma.cannedResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ header: 'End this chat?' }),
      }),
    );
    expect(result.headerTranslations).toEqual({});
  });

  it('does not require a header for a trigger that has none (e.g. greeting)', async () => {
    await expect(
      service.upsertAutoMessage('greeting', { body: 'Hi there!' }, 1),
    ).resolves.toBeDefined();

    expect(prisma.cannedResponse.upsert).toHaveBeenCalled();
  });
});

describe('CannedResponseService — server-side pagination', () => {
  let service: CannedResponseService;
  let prisma: {
    cannedResponseCategory: { findMany: jest.Mock; count: jest.Mock };
    cannedResponse: { findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      cannedResponseCategory: { findMany: jest.fn(), count: jest.fn() },
      cannedResponse: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CannedResponseService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CannedResponseService);
  });

  describe('getCannedResponseCategoriesPaginated', () => {
    it('passes skip/take through and returns items + total', async () => {
      prisma.cannedResponseCategory.findMany.mockResolvedValue([{ id: 'c-1' }]);
      prisma.cannedResponseCategory.count.mockResolvedValue(1);

      const result = await service.getCannedResponseCategoriesPaginated(0, 5);

      expect(prisma.cannedResponseCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null }, skip: 0, take: 5 }),
      );
      expect(result).toEqual({ items: [{ id: 'c-1' }], total: 1 });
    });
  });

  describe('getCannedResponsesPaginated', () => {
    const rowFixture = {
      id: 'cr-1',
      title: 'Hello',
      body: 'body',
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Greetings' },
      translations: [{ language: { code: 'en' }, body: 'Hello there' }],
    };

    it('scopes to a specific category when categoryId is a real id', async () => {
      prisma.cannedResponse.findMany.mockResolvedValue([rowFixture]);
      prisma.cannedResponse.count.mockResolvedValue(1);

      const result = await service.getCannedResponsesPaginated('cat-1', 0, 5);

      expect(prisma.cannedResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trigger: null, deletedAt: null, categoryId: 'cat-1' },
          skip: 0,
          take: 5,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.items[0].translations).toEqual({ en: 'Hello there' });
    });

    it('scopes to the "Uncategorized" bucket when categoryId is null', async () => {
      prisma.cannedResponse.findMany.mockResolvedValue([]);
      prisma.cannedResponse.count.mockResolvedValue(0);

      await service.getCannedResponsesPaginated(null, 0, 5);

      expect(prisma.cannedResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trigger: null, deletedAt: null, categoryId: null },
        }),
      );
    });

    it('omits the categoryId filter entirely when categoryId is undefined', async () => {
      prisma.cannedResponse.findMany.mockResolvedValue([]);
      prisma.cannedResponse.count.mockResolvedValue(0);

      await service.getCannedResponsesPaginated(undefined, 0, 5);

      const where = prisma.cannedResponse.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ trigger: null, deletedAt: null });
      expect(where).not.toHaveProperty('categoryId');
    });
  });
});
