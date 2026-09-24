// src/modules/pages/infrastructure/prisma-page-translation.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PageTranslation, Prisma } from '@prisma/client';
import {
  IPageTranslationRepository,
  PageTranslationFilters,
  CreatePageTranslationData,
  UpdatePageTranslationData,
} from '../domain';

@Injectable()
export class PrismaPageTranslationRepository implements IPageTranslationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private buildWhere(filters?: PageTranslationFilters): Prisma.PageTranslationWhereInput {
    if (!filters) return {};
    const where: Prisma.PageTranslationWhereInput = {};

    if (filters.pageId !== undefined) where.pageId = filters.pageId;
    if (filters.languageId !== undefined) where.languageId = filters.languageId;
    if (filters.slug !== undefined) where.slug = filters.slug;

    return where;
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  async findAll(filters?: PageTranslationFilters): Promise<PageTranslation[]> {
    return this.prisma.pageTranslation.findMany({
      where: this.buildWhere(filters),
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number): Promise<PageTranslation | null> {
    return this.prisma.pageTranslation.findFirst({
      where: { id },
    });
  }

  async findByPageAndLanguage(pageId: number, languageId: number): Promise<PageTranslation | null> {
    return this.prisma.pageTranslation.findFirst({
      where: { pageId, languageId },
    });
  }

  async findBySlug(slug: string): Promise<PageTranslation | null> {
    return this.prisma.pageTranslation.findFirst({
      where: { slug },
    });
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  async create(data: CreatePageTranslationData): Promise<PageTranslation> {
    return this.prisma.pageTranslation.create({
      data: {
        pageId: data.pageId,
        languageId: data.languageId,
        title: data.title,
        slug: data.slug,
        subtitle: data.subtitle ?? null,
        excerpt: data.excerpt ?? null,
        content: data.content ?? null,
        description: data.description ?? null,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        keywords: data.keywords ?? null,
        focusKeyword: data.focusKeyword ?? null,
        canonicalUrl: data.canonicalUrl ?? null,
        publishedAt: data.publishedAt ?? null,
      },
    });
  }

  async update(id: number, data: UpdatePageTranslationData): Promise<PageTranslation> {
    return this.prisma.pageTranslation.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.keywords !== undefined && { keywords: data.keywords }),
        ...(data.focusKeyword !== undefined && { focusKeyword: data.focusKeyword }),
        ...(data.canonicalUrl !== undefined && { canonicalUrl: data.canonicalUrl }),
        ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
      },
    });
  }

  async upsert(
    pageId: number,
    languageId: number,
    data: UpdatePageTranslationData,
  ): Promise<PageTranslation> {
    return this.prisma.pageTranslation.upsert({
      where: {
        pageId_languageId: { pageId, languageId },
      },
      update: {
        ...data,
        deletedAt: null, // Restore if was soft-deleted
      },
      create: {
        pageId,
        languageId,
        title: data.title || '',
        slug: data.slug || '',
        subtitle: data.subtitle ?? null,
        excerpt: data.excerpt ?? null,
        content: data.content ?? null,
        description: data.description ?? null,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        keywords: data.keywords ?? null,
        focusKeyword: data.focusKeyword ?? null,
        canonicalUrl: data.canonicalUrl ?? null,
        publishedAt: data.publishedAt ?? null,
      },
    });
  }

  async delete(id: number): Promise<PageTranslation> {
    return this.prisma.pageTranslation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async deleteByPageId(pageId: number): Promise<void> {
    await this.prisma.pageTranslation.updateMany({
      where: { pageId },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // UTILITY OPERATIONS
  // ==========================================

  async isSlugUnique(slug: string, excludeId?: number): Promise<boolean> {
    const existing = await this.prisma.pageTranslation.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return !existing;
  }
}
