// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/infrastructure/prisma-settings.repository.ts
// ─────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import type { SettingLocalizedContent, SettingGlobalContent } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SettingsRepository,
  SettingWithRelations,
  CreateSettingData,
  UpdateSettingData,
} from '../domain/settings.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import { SettingFilters } from '../dto';

const FULL_INCLUDE = {
  settingGlobalContent: true,
  settingLocalizedContent: true,
} as const;

@Injectable()
export class PrismaSettingsRepository extends SettingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ==================================================
  // READ
  // ==================================================

  async findById(id: number): Promise<SettingWithRelations | null> {
    return this.prisma.setting.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    }) as unknown as SettingWithRelations | null;
  }

  async findByKey(key: string): Promise<SettingWithRelations | null> {
    return this.prisma.setting.findUnique({
      where: { key },
      include: FULL_INCLUDE,
    }) as unknown as SettingWithRelations | null;
  }

  async findAll(): Promise<SettingWithRelations[]> {
    return this.prisma.setting.findMany({
      include: FULL_INCLUDE,
      orderBy: [{ key: 'asc' }],
    }) as unknown as SettingWithRelations[];
  }

  async findPaginated(
    filters?: SettingFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<SettingWithRelations>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const where = this.buildWhere(filters);

    const [data, total] = await Promise.all([
      this.prisma.setting.findMany({
        where,
        include: FULL_INCLUDE,
        orderBy: this.buildOrderBy(pagination),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.setting.count({ where }),
    ]);

    return {
      data: data as unknown as SettingWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Optimized single query for public site.
   *
   * Filters: isPublic=true, isActive=true
   * Translations: filtered by languageId (no extra data)
   * Values: always included (for non-translatable)
   *
   * One round-trip, no N+1.
   */
  async findPublicActive(languageId: number): Promise<SettingWithRelations[]> {
    return this.prisma.setting.findMany({
      where: {
        isPublic: true,
        isActive: true,
      },
      include: {
        settingLocalizedContent: {
          where: { languageId },
        },
        settingGlobalContent: true,
      },
      orderBy: [{ key: 'asc' }],
    }) as unknown as SettingWithRelations[];
  }

  // ==================================================
  // WRITE — Setting
  // ==================================================

  async create(data: CreateSettingData): Promise<SettingWithRelations> {
    return this.prisma.setting.create({
      data: {
        key: data.key,
        label: data.label,
        description: data.description ?? null,
        isPublic: data.isPublic ?? false,
        isActive: data.isActive ?? true,
      },
      include: FULL_INCLUDE,
    }) as unknown as SettingWithRelations;
  }

  async update(id: number, data: UpdateSettingData): Promise<SettingWithRelations> {
    return this.prisma.setting.update({
      where: { id },
      data,
      include: FULL_INCLUDE,
    }) as unknown as SettingWithRelations;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.setting.delete({ where: { id } });
  }

  // ==================================================
  // WRITE — Value (non-translatable)
  // ==================================================

  async upsertLocalizedContent(
    settingId: number,
    languageId: number,
    value: any,
  ): Promise<SettingLocalizedContent> {
    return this.prisma.settingLocalizedContent.upsert({
      where: {
        settingId_languageId: { settingId, languageId },
      },
      create: { settingId, languageId, value },
      update: { value },
    });
  }

  // ==================================================
  // WRITE — Translation (translatable)
  // ==================================================

  async upsertsettingGlobalContent(settingId: number, value: any): Promise<SettingGlobalContent> {
    return this.prisma.settingGlobalContent.upsert({
      where: { settingId },
      create: { settingId, value },
      update: { value },
    });
  }

  private buildWhere(filters?: SettingFilters): Prisma.SettingWhereInput {
    const where: Prisma.SettingWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters?.search) {
      where.OR = [
        { key: { contains: filters.search, mode: 'insensitive' } },
        { label: { contains: filters.search, mode: 'insensitive' } },
        {
          description: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): Prisma.SettingOrderByWithRelationInput {
    const sortBy = pagination?.sortBy ?? 'key';
    const sortOrder = pagination?.sortOrder ?? 'asc';

    const allowedFields: Record<string, keyof Prisma.SettingOrderByWithRelationInput> = {
      key: 'key',
      label: 'label',
      isActive: 'isActive',
      isPublic: 'isPublic',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };

    const field = allowedFields[sortBy] ?? 'key';
    return { [field]: sortOrder };
  }
}
