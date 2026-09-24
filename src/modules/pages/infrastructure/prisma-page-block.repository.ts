// src/modules/pages/infrastructure/prisma-page-block.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PageContentBlock, Prisma } from '@prisma/client';
import {
  IPageBlockRepository,
  PageBlockFilters,
  CreatePageBlockData,
  UpdatePageBlockData,
} from '../domain';

@Injectable()
export class PrismaPageBlockRepository implements IPageBlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private buildWhere(filters?: PageBlockFilters): Prisma.PageContentBlockWhereInput {
    if (!filters) return {};

    const where: Prisma.PageContentBlockWhereInput = {};

    if (filters.translationId !== undefined) where.translationId = filters.translationId;
    if (filters.type !== undefined) where.type = filters.type;

    return where;
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  async findAll(filters?: PageBlockFilters): Promise<PageContentBlock[]> {
    return this.prisma.pageContentBlock.findMany({
      where: this.buildWhere(filters),
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: number): Promise<PageContentBlock | null> {
    return this.prisma.pageContentBlock.findUnique({ where: { id } });
  }

  async findByTranslationId(translationId: number): Promise<PageContentBlock[]> {
    return this.prisma.pageContentBlock.findMany({
      where: { translationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  async create(data: CreatePageBlockData): Promise<PageContentBlock> {
    return this.prisma.pageContentBlock.create({
      data: {
        translationId: data.translationId,
        type: data.type,
        data: data.data,
        sortOrder: data.sortOrder,
      },
    });
  }

  async createMany(data: CreatePageBlockData[]): Promise<PageContentBlock[]> {
    await this.prisma.pageContentBlock.createMany({
      data: data.map((block) => ({
        translationId: block.translationId,
        type: block.type,
        data: block.data,
        sortOrder: block.sortOrder,
      })),
    });

    // Return created blocks (createMany doesn't return records)
    if (data.length === 0) return [];

    return this.prisma.pageContentBlock.findMany({
      where: { translationId: data[0].translationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async update(id: number, data: UpdatePageBlockData): Promise<PageContentBlock> {
    return this.prisma.pageContentBlock.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.data !== undefined && { data: data.data }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async upsert(id: number | undefined, data: CreatePageBlockData): Promise<PageContentBlock> {
    if (id) {
      return this.prisma.pageContentBlock.update({
        where: { id },
        data: {
          type: data.type,
          data: data.data,
          sortOrder: data.sortOrder,
        },
      });
    }

    return this.create(data);
  }

  async delete(id: number): Promise<PageContentBlock> {
    return this.prisma.pageContentBlock.delete({ where: { id } });
  }

  async deleteByTranslationId(translationId: number): Promise<void> {
    await this.prisma.pageContentBlock.deleteMany({
      where: { translationId },
    });
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  // translationId is part of the repository contract but unused here — block
  // ids are globally unique, so the update targets them directly.
  async reorder(_translationId: number, blockIds: number[]): Promise<void> {
    await this.prisma.$transaction(
      blockIds.map((id, index) =>
        this.prisma.pageContentBlock.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}
