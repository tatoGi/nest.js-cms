// src/modules/pages/api/mappers/page.mapper.ts

import {
  CreatePageAggregateDto,
  UpdatePageAggregateDto,
  PageAggregateResponseDto,
  PageListItemDto,
} from '../../dto';

import { PageAggregate, PageTranslation, PageBlock } from '../../domain';

/**
 * Mapper to convert between DTOs and Domain Aggregates
 */
export class PageMapper {
  // ==========================================
  // DTO → Domain Aggregate (CREATE)
  // ==========================================

  static toAggregate(dto: CreatePageAggregateDto): PageAggregate {
    return {
      parentId: dto.parentId ?? null,
      templateId: dto.templateId || 1,
      sortOrder: dto.sortOrder ?? 0,
      published: dto.published ?? false,
      showInMenu: dto.showInMenu ?? false,
      isHome: dto.isHome ?? false,
      featureImageId: dto.featureImageId ?? null,

      translations: dto.translations.map<PageTranslation>((t) => ({
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        subtitle: t.subtitle ?? null,
        excerpt: t.excerpt ?? null,
        content: t.content ?? null,
        description: t.description ?? null,
        metaTitle: t.metaTitle ?? null,
        metaDescription: t.metaDescription ?? null,
        keywords: t.keywords ?? null,
        focusKeyword: t.focusKeyword ?? null,
        canonicalUrl: t.canonicalUrl ?? null,
        publishedAt: t.publishedAt ? new Date(t.publishedAt) : null,

        blocks: t.blocks.map<PageBlock>((b) => ({
          type: b.type,
          data: b.data,
          sortOrder: b.sortOrder,
        })),
      })),
    };
  }

  // ==========================================
  // DTO → Domain Aggregate (UPDATE)
  // ==========================================

  static toAggregateForUpdate(
    dto: UpdatePageAggregateDto,
    existingAggregate?: PageAggregate,
  ): Partial<PageAggregate> {
    return {
      parentId: dto.parentId !== undefined ? dto.parentId : existingAggregate?.parentId,
      templateId: dto.templateId ?? existingAggregate?.templateId ?? 1,
      sortOrder: dto.sortOrder ?? existingAggregate?.sortOrder ?? 0,
      published: dto.published ?? existingAggregate?.published ?? false,
      showInMenu: dto.showInMenu ?? existingAggregate?.showInMenu ?? false,
      isHome: dto.isHome ?? existingAggregate?.isHome ?? false,
      featureImageId:
        dto.featureImageId !== undefined
          ? dto.featureImageId
          : (existingAggregate?.featureImageId ?? null),

      translations: dto.translations.map<PageTranslation>((t) => ({
        id: t.id, // Include ID for existing translations
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        subtitle: t.subtitle ?? null,
        excerpt: t.excerpt ?? null,
        content: t.content ?? null,
        description: t.description ?? null,
        metaTitle: t.metaTitle ?? null,
        metaDescription: t.metaDescription ?? null,
        keywords: t.keywords ?? null,
        focusKeyword: t.focusKeyword ?? null,
        canonicalUrl: t.canonicalUrl ?? null,
        publishedAt: t.publishedAt ? new Date(t.publishedAt) : null,

        blocks: t.blocks.map<PageBlock>((b) => ({
          id: b.id, // Include ID for existing blocks
          type: b.type,
          data: b.data,
          sortOrder: b.sortOrder,
        })),
      })),
    };
  }

  // ==========================================
  // Domain Aggregate → Response DTO
  // ==========================================

  static toResponse(aggregate: PageAggregate): PageAggregateResponseDto {
    return {
      id: aggregate.id!,
      parentId: aggregate.parentId ?? null,
      templateId: aggregate.templateId,
      sortOrder: aggregate.sortOrder,
      published: aggregate.published,
      showInMenu: aggregate.showInMenu,
      isHome: aggregate.isHome,
      featureImageId: aggregate.featureImageId ?? null,
      featureImage: aggregate.featureImage ?? null,
      createdById: aggregate.createdById ?? null,
      updatedById: aggregate.updatedById ?? null,
      createdAt: aggregate.createdAt!,
      updatedAt: aggregate.updatedAt!,
      templateData: aggregate.templateData ?? null,

      translations: aggregate.translations.map((t) => ({
        id: t.id!,
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        subtitle: t.subtitle ?? null,
        excerpt: t.excerpt ?? null,
        content: t.content ?? null,
        description: t.description ?? null,
        metaTitle: t.metaTitle ?? null,
        metaDescription: t.metaDescription ?? null,
        keywords: t.keywords ?? null,
        focusKeyword: t.focusKeyword ?? null,
        canonicalUrl: t.canonicalUrl ?? null,
        publishedAt: t.publishedAt ?? null,
        language: t.language ?? null,

        blocks: t.blocks.map((b) => ({
          id: b.id!,
          type: b.type,
          data: b.data,
          sortOrder: b.sortOrder,
        })),
      })),
    };
  }

  // ==========================================
  // Domain Aggregate → List Item DTO
  // ==========================================

  static toListItem(aggregate: PageAggregate, languageId: number): PageListItemDto {
    const translation =
      aggregate.translations.find((t) => t.languageId === languageId) ?? aggregate.translations[0];

    return {
      id: aggregate.id!,
      parentId: aggregate.parentId ?? null,
      templateId: aggregate.templateId,
      sortOrder: aggregate.sortOrder,
      published: aggregate.published,
      showInMenu: aggregate.showInMenu,
      isHome: aggregate.isHome,
      featureImageId: aggregate.featureImageId ?? null,
      featureImage: aggregate.featureImage ?? null,
      createdAt: aggregate.createdAt!,
      updatedAt: aggregate.updatedAt!,
      deletedAt: aggregate.deletedAt ?? null,
      templateData: aggregate.templateData ?? null,

      translation: {
        id: translation.id!,
        languageId: translation.languageId,
        title: translation.title,
        slug: translation.slug,
        language: translation.language ?? null,
      },
    };
  }

  // ==========================================
  // Bulk conversion for list
  // ==========================================

  static toListItems(aggregates: PageAggregate[], languageId: number): PageListItemDto[] {
    return aggregates.map((aggregate) => this.toListItem(aggregate, languageId));
  }
}
