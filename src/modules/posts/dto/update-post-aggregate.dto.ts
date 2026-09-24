// src/modules/posts/dto/update-post-aggregate.dto.ts

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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostTypeEnum } from '../domain/post.aggregate';

export class UpdatePostBlockDto {
  @ApiPropertyOptional({
    description: 'Block ID (required for existing blocks)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    description: 'Block type key',
    example: 'text-block',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    description: 'Block data (JSON)',
    example: { content: 'Lorem ipsum...' },
  })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 0,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class UpdatePostTranslationDto {
  @ApiPropertyOptional({
    description: 'Translation ID (required for existing translations)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    description: 'Language ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  languageId: number;

  @ApiPropertyOptional({
    description: 'Post title',
    example: 'Getting Started with NestJS',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
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
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Content blocks',
    type: [UpdatePostBlockDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePostBlockDto)
  blocks?: UpdatePostBlockDto[];
}

export class UpdatePostAggregateDto {
  @ApiPropertyOptional({
    description: 'Post type',
    enum: PostTypeEnum,
  })
  @IsOptional()
  @IsEnum(PostTypeEnum)
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
  })
  @IsOptional()
  @IsInt()
  coverImageId?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the post is published',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the post is featured',
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Publish date/time',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Page IDs where this post should appear',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  pageIds?: number[];

  @ApiPropertyOptional({
    description: 'Post translations',
    type: [UpdatePostTranslationDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Post must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdatePostTranslationDto)
  translations?: UpdatePostTranslationDto[];

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
