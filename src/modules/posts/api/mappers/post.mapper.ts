// src/modules/posts/api/mappers/post.mapper.ts

import {
  CreatePostAggregateDto,
  UpdatePostAggregateDto,
  PostAggregateResponseDto,
  PostListItemDto,
} from '../../dto';
import { PostAggregate, PostTranslation, PostContentBlock } from '../../domain';

export class PostMapper {
  // ==========================================
  // DTO → Domain Aggregate (CREATE)
  // ==========================================

  static toAggregate(dto: CreatePostAggregateDto): PostAggregate {
    return {
      type: (dto.type ?? 'news') as any,
      authorId: dto.authorId ?? null,
      coverImageId: dto.coverImageId ?? null,
      published: dto.published ?? false,
      isFeatured: dto.isFeatured ?? false,
      viewCount: 0,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),

      pageIds: dto.pageIds ?? [],
      categoryIds: dto.categoryIds ?? [],

      translations: dto.translations.map<PostTranslation>((t) => ({
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt ?? null,
        content: t.content ?? null,
        metaTitle: t.metaTitle ?? null,
        metaDescription: t.metaDescription ?? null,
        blocks:
          t.blocks?.map<PostContentBlock>((b) => ({
            type: b.type,
            data: b.data,
            sortOrder: b.sortOrder,
          })) ?? [],
      })),
    };
  }

  // ==========================================
  // DTO → Domain Aggregate (UPDATE)
  // ==========================================

  static toAggregateForUpdate(
    dto: UpdatePostAggregateDto,
    existingAggregate: PostAggregate,
  ): Partial<PostAggregate> {
    const result: Partial<PostAggregate> = {
      type: (dto.type ?? existingAggregate.type) as any,
      authorId: dto.authorId !== undefined ? dto.authorId : existingAggregate.authorId,
      coverImageId:
        dto.coverImageId !== undefined ? dto.coverImageId : existingAggregate.coverImageId,
      published: dto.published ?? existingAggregate.published,
      isFeatured: dto.isFeatured ?? existingAggregate.isFeatured,
      publishedAt:
        dto.publishedAt !== undefined
          ? dto.publishedAt
            ? new Date(dto.publishedAt)
            : null
          : existingAggregate.publishedAt,
    };

    if (dto.translations) {
      result.translations = dto.translations.map<PostTranslation>((t) => {
        const existingTranslation = existingAggregate.translations.find(
          (et) => et.languageId === t.languageId,
        );

        return {
          id: t.id ?? existingTranslation?.id,
          postId: existingAggregate.id,
          languageId: t.languageId,
          title: t.title,
          slug: t.slug,
          excerpt: t.excerpt ?? existingTranslation?.excerpt ?? null,
          content: t.content ?? existingTranslation?.content ?? null,
          metaTitle: t.metaTitle ?? existingTranslation?.metaTitle ?? null,
          metaDescription: t.metaDescription ?? existingTranslation?.metaDescription ?? null,
          blocks:
            t.blocks?.map<PostContentBlock>((b) => ({
              id: b.id,
              type: b.type,
              data: b.data,
              sortOrder: b.sortOrder,
            })) ??
            existingTranslation?.blocks ??
            [],
        };
      });
    }

    if (dto?.categoryIds !== undefined) {
      result.categoryIds = dto.categoryIds;
    }

    if (dto?.pageIds !== undefined) {
      result.pageIds = dto.pageIds;
    }

    return result;
  }

  // ==========================================
  // Domain Aggregate → Response DTO
  // ==========================================

  static toResponse(aggregate: PostAggregate): PostAggregateResponseDto {
    return {
      id: aggregate.id!,
      type: aggregate.type as any,
      authorId: aggregate.authorId,
      author: aggregate.author
        ? {
            id: aggregate.author.id,
            name: aggregate.author.displayName,
            email: aggregate.author.email,
          }
        : null,
      coverImageId: aggregate.coverImageId,
      coverImage: aggregate.coverImage ?? null,
      published: aggregate.published,
      isFeatured: aggregate.isFeatured,
      viewCount: aggregate.viewCount,
      publishedAt: aggregate.publishedAt,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      translations: aggregate.translations.map((t) => ({
        id: t.id!,
        postId: aggregate.id!,
        languageId: t.languageId,
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt,
        content: t.content,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
        createdAt: t.createdAt!,
        updatedAt: t.updatedAt!,
        blocks: t.blocks.map((b) => ({
          id: b.id!,
          translationId: t.id!,
          type: b.type,
          data: b.data,
          sortOrder: b.sortOrder,
          createdAt: b.createdAt!,
          updatedAt: b.updatedAt!,
        })),
      })),
      slugAliases: aggregate.slugAliases?.map((a) => ({
        id: a.id!,
        postId: aggregate.id!,
        languageId: a.languageId,
        slug: a.slug,
        createdAt: a.createdAt!,
      })),
      pageIds: aggregate.pageIds ?? [],
      categoryIds: aggregate.categoryIds ?? [],
    };
  }

  // ==========================================
  // Domain Aggregate → List Item DTO
  // ==========================================

  static toListItem(aggregate: PostAggregate, languageId: number): PostListItemDto {
    const translation =
      aggregate.translations.find((t) => t.languageId === languageId) ?? aggregate.translations[0];

    return {
      id: aggregate.id!,
      authorId: aggregate.authorId,
      author: aggregate.author
        ? {
            id: aggregate.author.id,
            name: aggregate.author.displayName,
          }
        : null,
      coverImageId: aggregate.coverImageId,
      coverImage: aggregate.coverImage ?? null,
      published: aggregate.published,
      isFeatured: aggregate.isFeatured,
      viewCount: aggregate.viewCount,
      publishedAt: aggregate.publishedAt,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      deletedAt: aggregate.deletedAt ?? null,
      translation: {
        id: translation?.id ?? 0,
        languageId: translation?.languageId ?? languageId,
        title: translation?.title ?? '',
        slug: translation?.slug ?? '',
        excerpt: translation?.excerpt ?? null,
      },
    };
  }

  static toListItems(aggregates: PostAggregate[], languageId: number): PostListItemDto[] {
    return aggregates.map((aggregate) => this.toListItem(aggregate, languageId));
  }
}
