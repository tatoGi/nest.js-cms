// src/modules/pages/dto/update-page-aggregate.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating a page content block
 */
export class UpdatePageBlockDto {
  @ApiPropertyOptional({
    description: 'Block ID (required for existing blocks)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    description: 'Block type key',
    example: 'hero-banner',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    description: 'Block data (JSON)',
    example: { title: 'Welcome', subtitle: 'To our site' },
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

/**
 * DTO for updating a page translation
 */
export class UpdatePageTranslationDto {
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
    description: 'Page title',
    example: 'About Us',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Page slug (URL-friendly)',
    example: 'about-us',
  })
  @IsString()
  @MaxLength(255)
  // @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  //   message: 'Slug must be lowercase letters, numbers, and hyphens only',
  // })
  slug: string;

  @ApiPropertyOptional({
    description: 'Page subtitle',
    example: 'Learn more about our company',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  @ApiPropertyOptional({
    description: 'Short excerpt',
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Full content (if not using blocks)',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Page description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'SEO meta title',
    example: 'About Us | Company Name',
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
    description: 'SEO keywords',
  })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiPropertyOptional({
    description: 'Focus keyword for SEO',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  focusKeyword?: string;

  @ApiPropertyOptional({
    description: 'Canonical URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'Canonical URL must be a valid URL' })
  canonicalUrl?: string;

  @ApiPropertyOptional({
    description: 'Published date',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({
    description: 'Content blocks',
    type: [UpdatePageBlockDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePageBlockDto)
  blocks: UpdatePageBlockDto[];
}

/**
 * DTO for updating a page aggregate
 */
export class UpdatePageAggregateDto {
  @ApiPropertyOptional({
    description: 'Parent page ID',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiPropertyOptional({
    description: 'Page template ID',
  })
  @IsOptional()
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({
    description: 'Sort order',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the page is published',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to show in menu',
  })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is the homepage',
  })
  @IsOptional()
  @IsBoolean()
  isHome?: boolean;

  @ApiPropertyOptional({
    description: 'Feature image media ID',
  })
  @IsOptional()
  @IsInt()
  featureImageId?: number | null;

  @ApiPropertyOptional({
    description: 'Page translations (at least one required)',
    type: [UpdatePageTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Page must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdatePageTranslationDto)
  translations: UpdatePageTranslationDto[];
}
