// src/modules/languages/infrastructure/prisma-language.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Language } from '@prisma/client';
import {
  ILanguageRepository,
  LanguageFilters,
  CreateLanguageData,
  UpdateLanguageData,
} from '../domain/languages.repository';

@Injectable()
export class PrismaLanguageRepository implements ILanguageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters?: LanguageFilters): any {
    if (!filters) return {};

    const where: any = {};

    if (filters.code) {
      where.code = filters.code;
    }

    if (typeof filters.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    if (typeof filters.isDefault === 'boolean') {
      where.isDefault = filters.isDefault;
    }

    if (filters.direction) {
      where.direction = filters.direction;
    }

    if (filters.searchTerm) {
      where.OR = [
        { code: { contains: filters.searchTerm, mode: 'insensitive' } },
        { name: { contains: filters.searchTerm, mode: 'insensitive' } },
        { englishName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { georgianName: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Find all languages with optional filters
   */
  async findAll(filters?: LanguageFilters): Promise<Language[]> {
    const where = this.buildWhereClause(filters);

    return this.prisma.language.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find a language by ID
   */
  async findById(id: number): Promise<Language | null> {
    return this.prisma.language.findUnique({
      where: { id },
    });
  }

  /**
   * Find a language by code
   */
  async findByCode(code: string): Promise<Language | null> {
    return this.prisma.language.findUnique({
      where: { code },
    });
  }

  /**
   * Check if a language code exists (excluding a specific ID)
   */
  async codeExists(code: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.language.count({
      where: {
        code,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return count > 0;
  }

  /**
   * Create a new language
   */
  async create(data: CreateLanguageData): Promise<Language> {
    return this.prisma.language.create({
      data: {
        code: data.code,
        name: data.name,
        englishName: data.englishName,
        georgianName: data.georgianName,
        flagEmoji: data.flagEmoji,
        direction: data.direction ?? 'ltr',
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  /**
   * Update a language
   */
  async update(id: number, data: UpdateLanguageData): Promise<Language> {
    const updateData: any = {};

    console.log(
      'PrismaLanguageRepository.update: data=========================================',
      data,
    );

    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.englishName !== undefined) updateData.englishName = data.englishName;
    if (data.georgianName !== undefined) updateData.georgianName = data.georgianName;
    if (data.flagEmoji !== undefined) updateData.flagEmoji = data.flagEmoji;
    if (data.direction !== undefined) updateData.direction = data.direction;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    return this.prisma.language.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a language
   */
  async delete(id: number): Promise<Language> {
    return this.prisma.language.delete({
      where: { id },
    });
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<Language> {
    const language = await this.findById(id);

    if (!language) {
      throw new Error(`Language with ID ${id} not found`);
    }

    return this.prisma.language.update({
      where: { id },
      data: { isActive: !language.isActive },
    });
  }

  /**
   * Count languages
   */
  async count(filters?: LanguageFilters): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.language.count({ where });
  }

  /**
   * Find active languages
   */
  async findActive(): Promise<Language[]> {
    return this.prisma.language.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find default language
   */
  async findDefault(): Promise<Language | null> {
    return this.prisma.language.findFirst({
      where: { isDefault: true },
    });
  }
}
