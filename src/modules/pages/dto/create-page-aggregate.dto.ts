// src/modules/pages/dto/create-page-aggregate.dto.ts

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
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a page content block
 */
export class CreatePageBlockDto {
  @ApiProperty({
    description: 'Block type key (must match BlockTypeDefinition)',
    example: 'hero-banner',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({
    description: 'Block data (JSON)',
    example: { title: 'Welcome', subtitle: 'To our site' },
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

/**
 * DTO for creating a page translation
 */
export class CreatePageTranslationDto {
  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  languageId: number;

  @ApiProperty({
    description: 'Page title',
    example: 'About Us',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
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
    example: 'We are a leading company...',
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
    example: 'Learn about our company history and mission',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'SEO keywords',
    example: 'company, about, mission',
  })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiPropertyOptional({
    description: 'Focus keyword for SEO',
    example: 'about us',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  focusKeyword?: string;

  @ApiPropertyOptional({
    description: 'Canonical URL',
    example: 'https://example.com/about-us',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'Canonical URL must be a valid URL' })
  canonicalUrl?: string;

  @ApiPropertyOptional({
    description: 'Published date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiProperty({
    description: 'Content blocks',
    type: [CreatePageBlockDto],
    default: [],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePageBlockDto)
  blocks: CreatePageBlockDto[];
}

/**
 * DTO for creating a complete page aggregate
 */
export class CreatePageAggregateDto {
  @ApiPropertyOptional({
    description: 'Parent page ID (for hierarchical pages)',
    example: null,
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiProperty({
    description: 'Page template ID',
    example: 1,
    default: 1,
  })
  @IsInt()
  templateId: number;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({
    description: 'Whether the page is published',
    example: false,
    default: false,
  })
  @IsBoolean()
  published: boolean;

  @ApiProperty({
    description: 'Whether to show in menu',
    example: true,
    default: false,
  })
  @IsBoolean()
  showInMenu: boolean;

  @ApiProperty({
    description: 'Whether this is the homepage',
    example: false,
    default: false,
  })
  @IsBoolean()
  isHome: boolean;

  @ApiPropertyOptional({
    description: 'Feature image media ID',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  featureImageId?: number | null;

  @ApiProperty({
    description: 'Page translations (at least one required)',
    type: [CreatePageTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Page must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePageTranslationDto)
  translations: CreatePageTranslationDto[];
}
