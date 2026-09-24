// src/modules/menus/dto/create-menu-aggregate.dto.ts

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a menu item translation
 */
export class CreateMenuItemTranslationDto {
  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  languageId: number;

  @ApiPropertyOptional({
    description: 'Menu Item ID (ignored)',
  })
  @IsOptional()
  @IsInt()
  menuItemId?: number; // ← ADD THIS (optional for create)

  @ApiProperty({
    description: 'Menu item label',
    example: 'Home',
  })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({
    description: 'Menu item slug',
    example: '/about',
  })
  @IsString()
  @MaxLength(255)
  slug: string;
}

/**
 * DTO for creating a menu item
 */
export class CreateMenuItemDto {
  @ApiPropertyOptional({
    description: 'Parent menu item ID (for nested items)',
    example: null,
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiProperty({
    description: 'Whether the menu is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({
    description: 'Item type',
    enum: ['custom', 'page', 'post'],
    example: 'custom',
  })
  @IsIn(['custom', 'page', 'post'])
  type: 'custom' | 'page' | 'post';

  @ApiPropertyOptional({
    description: 'Custom URL (required if type is custom)',
    example: 'https://example.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @ApiProperty({
    description: 'Link target',
    enum: ['_self', '_blank'],
    default: '_self',
  })
  @IsIn(['_self', '_blank'])
  target: '_self' | '_blank';

  @ApiPropertyOptional({
    description: 'Reference ID (page ID or post ID)',
    example: null,
  })
  @IsOptional()
  @IsInt()
  referenceId?: number | null;

  @ApiProperty({
    description: 'Menu item translations (at least one required)',
    type: [CreateMenuItemTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Menu item must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateMenuItemTranslationDto)
  translations: CreateMenuItemTranslationDto[];
}

/**
 * DTO for creating a complete menu aggregate
 */
export class CreateMenuAggregateDto {
  @ApiProperty({
    description: 'Menu title',
    example: 'Main Navigation',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Menu slug (URL-friendly identifier)',
    example: 'main-navigation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  // @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  //   message: 'Slug must be lowercase letters, numbers, and hyphens only',
  // })
  slug?: string;

  @ApiProperty({
    description: 'Whether the menu is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Menu items',
    type: [CreateMenuItemDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMenuItemDto)
  items?: CreateMenuItemDto[];
}
