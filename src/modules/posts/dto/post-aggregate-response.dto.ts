// src/modules/posts/dto/post-aggregate-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaEmbedDto } from '@/modules/media/dto';
import { PostTypeEnum } from '../domain/post.aggregate';

export class PostBlockResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  translationId: number;

  @ApiProperty({ example: 'text-block' })
  type: string;

  @ApiProperty({ example: { content: 'Lorem ipsum...' } })
  data: Record<string, any>;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PostTranslationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  postId: number;

  @ApiProperty({ example: 1 })
  languageId: number;

  @ApiProperty({ example: 'Getting Started with NestJS' })
  title: string;

  @ApiProperty({ example: 'getting-started-with-nestjs' })
  slug: string;

  @ApiPropertyOptional({ example: 'Learn how to build...' })
  excerpt: string | null;

  @ApiPropertyOptional()
  content: string | null;

  @ApiPropertyOptional({ example: 'Getting Started | Blog' })
  metaTitle: string | null;

  @ApiPropertyOptional()
  metaDescription: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [PostBlockResponseDto] })
  blocks: PostBlockResponseDto[];
}

export class PostSlugAliasResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  postId: number;

  @ApiProperty({ example: 1 })
  languageId: number;

  @ApiProperty({ example: 'old-post-slug' })
  slug: string;

  @ApiProperty()
  createdAt: Date;
}

export class PostAuthorResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;
}

export class PostPageResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Blog' })
  title: string;

  @ApiProperty({ example: 'blog' })
  slug: string;
}

export class PostAggregateResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ enum: PostTypeEnum, example: PostTypeEnum.NEWS })
  type: PostTypeEnum;

  @ApiPropertyOptional({ example: 1 })
  authorId: number | null;

  @ApiPropertyOptional({ type: PostAuthorResponseDto })
  author: PostAuthorResponseDto | null;

  @ApiPropertyOptional({ example: 42 })
  coverImageId: number | null;

  @ApiPropertyOptional({ type: MediaEmbedDto })
  coverImage?: MediaEmbedDto | null;

  @ApiProperty({ example: false })
  published: boolean;

  @ApiProperty({ example: false })
  isFeatured: boolean;

  @ApiProperty({ example: 0 })
  viewCount: number;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [PostTranslationResponseDto] })
  translations: PostTranslationResponseDto[];

  @ApiPropertyOptional({ type: [PostSlugAliasResponseDto] })
  slugAliases?: PostSlugAliasResponseDto[];

  @ApiPropertyOptional({ type: [PostPageResponseDto] })
  pages?: PostPageResponseDto[];

  @ApiPropertyOptional({
    description: 'Selected page IDs',
    example: [1, 2],
  })
  pageIds?: number[];

  @ApiPropertyOptional({
    description: 'Selected category IDs',
    example: [3, 5],
  })
  categoryIds?: number[];
}
