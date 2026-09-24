// src/modules/posts/dto/create-post-aggregate.dto.ts

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostTypeEnum } from '../domain/post.aggregate';

export class CreatePostBlockDto {
  @ApiProperty({
    description: 'Block type key',
    example: 'text-block',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({
    description: 'Block data (JSON)',
    example: { content: 'Lorem ipsum...' },
  })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class CreatePostTranslationDto {
  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  languageId: number;

  @ApiProperty({
    description: 'Post title',
    example: 'Getting Started with NestJS',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Post slug (URL-friendly)',
    example: 'getting-started-with-nestjs',
  })
  @IsString()
  @MaxLength(255)
  // @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  //   message: 'Slug must be lowercase letters, numbers, and hyphens only',
  // })
  slug: string;

  @ApiPropertyOptional({
    description: 'Short excerpt',
    example: 'Learn how to build scalable applications...',
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Full content',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'SEO meta title',
    example: 'Getting Started with NestJS | Blog',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description',
    example: 'Learn how to build scalable Node.js applications with NestJS',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Content blocks',
    type: [CreatePostBlockDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePostBlockDto)
  blocks?: CreatePostBlockDto[];
}

export class CreatePostAggregateDto {
  @ApiProperty({
    description: 'Post type',
    enum: PostTypeEnum,
    default: PostTypeEnum.NEWS,
  })
  @IsEnum(PostTypeEnum)
  @IsOptional()
  type?: PostTypeEnum;

  @ApiPropertyOptional({
    description: 'Author ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  authorId?: number | null;

  @ApiPropertyOptional({
    description: 'Cover image media ID',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  coverImageId?: number | null;

  @ApiProperty({
    description: 'Whether the post is published',
    example: false,
    default: false,
  })
  @IsBoolean()
  published: boolean;

  @ApiProperty({
    description: 'Whether the post is featured',
    example: false,
    default: false,
  })
  @IsBoolean()
  isFeatured: boolean;

  @ApiPropertyOptional({
    description: 'Publish date/time',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: 'Page IDs where this post should appear',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  pageIds?: number[];

  @ApiProperty({
    description: 'Post translations (at least one required)',
    type: [CreatePostTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Post must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePostTranslationDto)
  translations: CreatePostTranslationDto[];

  @ApiPropertyOptional({
    description: 'Category IDs',
    example: [1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];
}
