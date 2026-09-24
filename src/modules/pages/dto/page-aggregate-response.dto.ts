// src/modules/pages/dto/page-aggregate-response.dto.ts

import { Language, PageTemplate } from '.prisma/client/default';
import { MediaEmbedDto } from '@/modules/media/dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for page content block
 */
export class PageBlockResponseDto {
  @ApiProperty({
    description: 'Block ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Block type',
    example: 'hero-banner',
  })
  type: string;

  @ApiProperty({
    description: 'Block data',
    example: { title: 'Welcome', subtitle: 'To our site' },
  })
  data: Record<string, any>;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
  })
  sortOrder: number;
}

/**
 * Response DTO for page translation
 */
export class PageTranslationResponseDto {
  @ApiProperty({
    description: 'Translation ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  languageId: number;

  @ApiProperty({
    description: 'Page title',
    example: 'About Us',
  })
  title: string;

  @ApiProperty({
    description: 'Page slug',
    example: 'about-us',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Page subtitle',
  })
  subtitle?: string | null;

  @ApiPropertyOptional({
    description: 'Short excerpt',
  })
  excerpt?: string | null;

  @ApiPropertyOptional({
    description: 'Full content',
  })
  content?: string | null;

  @ApiPropertyOptional({
    description: 'Page description',
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'SEO meta title',
  })
  metaTitle?: string | null;

  @ApiPropertyOptional({
    description: 'SEO meta description',
  })
  metaDescription?: string | null;

  @ApiPropertyOptional({
    description: 'SEO keywords',
  })
  keywords?: string | null;

  @ApiPropertyOptional({
    description: 'Focus keyword for SEO',
  })
  focusKeyword?: string | null;

  @ApiPropertyOptional({
    description: 'Canonical URL',
  })
  canonicalUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Published date',
  })
  publishedAt?: Date | null;

  @ApiProperty({
    description: 'Content blocks',
    type: [PageBlockResponseDto],
  })
  blocks: PageBlockResponseDto[];

  @ApiProperty({
    description: 'language data',
    nullable: true,
  })
  language: Language | null;
}

/**
 * Response DTO for complete page aggregate
 */
export class PageAggregateResponseDto {
  @ApiProperty({
    description: 'Page ID',
    example: 1,
  })
  id: number;

  @ApiPropertyOptional({
    description: 'Parent page ID',
  })
  parentId: number | null;

  @ApiProperty({
    description: 'Page template ID',
    example: 1,
  })
  templateId: number;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Whether the page is published',
  })
  published: boolean;

  @ApiProperty({
    description: 'Whether to show in menu',
  })
  showInMenu: boolean;

  @ApiProperty({
    description: 'Whether this is the homepage',
  })
  isHome: boolean;

  @ApiPropertyOptional({
    description: 'Feature image media ID',
  })
  featureImageId?: number | null;

  @ApiPropertyOptional({
    description: 'Feature image media object',
    type: MediaEmbedDto,
  })
  featureImage?: MediaEmbedDto | null;

  @ApiPropertyOptional({
    description: 'Created by user ID',
  })
  createdById?: number | null;

  @ApiPropertyOptional({
    description: 'Updated by user ID',
  })
  updatedById?: number | null;

  @ApiProperty({
    description: 'Page translations',
    type: [PageTranslationResponseDto],
  })
  translations: PageTranslationResponseDto[];

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'page template data',
    nullable: true,
  })
  templateData: PageTemplate | null;
}
