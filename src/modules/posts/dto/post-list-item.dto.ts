// src/modules/posts/dto/post-list-item.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaEmbedDto } from '@/modules/media/dto';

export class PostListTranslationDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  languageId: number;

  @ApiProperty({ example: 'Getting Started with NestJS' })
  title: string;

  @ApiProperty({ example: 'getting-started-with-nestjs' })
  slug: string;

  @ApiPropertyOptional({ example: 'Learn how to build...' })
  excerpt: string | null;
}

export class PostListAuthorDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;
}

export class PostListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: 1 })
  authorId: number | null;

  @ApiPropertyOptional({ type: PostListAuthorDto })
  author: PostListAuthorDto | null;

  @ApiPropertyOptional({ example: 42 })
  coverImageId: number | null;

  @ApiPropertyOptional({ type: MediaEmbedDto })
  coverImage?: MediaEmbedDto | null;

  @ApiProperty({ example: false })
  published: boolean;

  @ApiProperty({ example: false })
  isFeatured: boolean;

  @ApiProperty({ example: 150 })
  viewCount: number;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  deletedAt?: Date | null;

  @ApiProperty({ type: PostListTranslationDto })
  translation: PostListTranslationDto;
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
