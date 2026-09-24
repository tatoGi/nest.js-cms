import { PostCategoryAggregate } from '../../domain/post-category.aggregate';
import {
  PostCategoryAggregateResponseDto,
  PostCategoryTranslationResponseDto,
  PostCategoryListItemDto,
} from '../../dto';

export class PostCategoryMapper {
  static toAggregateResponse(entity: PostCategoryAggregate): PostCategoryAggregateResponseDto {
    return {
      id: entity.id,
      slug: entity.slug,
      parentId: entity.parentId,
      sortOrder: entity.sortOrder,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      translations: entity.translations.map((t) => PostCategoryMapper.toTranslationResponse(t)),
      children: entity.children?.map((child) => PostCategoryMapper.toAggregateResponse(child)),
      postCount: entity._count?.posts ?? 0,
    };
  }

  static toTranslationResponse(
    translation: PostCategoryAggregate['translations'][0],
  ): PostCategoryTranslationResponseDto {
    return {
      id: translation.id,
      languageId: translation.languageId,
      slug: translation.slug,
      name: translation.name,
      description: translation.description,
      createdAt: translation.createdAt,
      updatedAt: translation.updatedAt,
    };
  }

  static toListItem(
    entity: PostCategoryAggregate,
    languageId: number = 1,
  ): PostCategoryListItemDto {
    const translation =
      entity.translations.find((t) => t.languageId === languageId) ?? entity.translations[0];

    return {
      id: entity.id,
      slug: entity.slug,
      sortOrder: entity.sortOrder,
      isActive: entity.isActive,
      parentId: entity.parentId,
      name: translation?.name ?? '',
      description: translation?.description ?? null,
      translationSlug: translation?.slug ?? entity.slug,
      postCount: entity._count?.posts ?? 0,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toListItems(
    entities: PostCategoryAggregate[],
    languageId: number = 1,
  ): PostCategoryListItemDto[] {
    return entities.map((e) => PostCategoryMapper.toListItem(e, languageId));
  }
}
