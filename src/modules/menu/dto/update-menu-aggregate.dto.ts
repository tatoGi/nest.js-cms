// src/modules/menus/dto/update-menu-aggregate.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating a menu item translation
 */
export class UpdateMenuItemTranslationDto {
  @ApiPropertyOptional({
    description: 'Translation ID (required for existing translations)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    description: 'Menu Item ID (ignored, for reference only)',
  })
  @IsOptional()
  @IsInt()
  menuItemId?: number; // ← ADD THIS

  @ApiPropertyOptional({
    description: 'Language ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  languageId: number;

  @ApiPropertyOptional({
    description: 'Menu item label',
    example: 'Home',
  })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiPropertyOptional({
    description: 'Menu item slug',
    example: '/home',
  })
  @IsString()
  @MaxLength(255)
  slug: string;
}

/**
 * DTO for updating a menu item
 */
export class UpdateMenuItemDto {
  @ApiPropertyOptional({
    description: 'Menu item ID (required for existing items)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    description: 'Parent menu item ID',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiPropertyOptional({ description: 'Whether the menu is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Item type',
    enum: ['custom', 'page', 'post'],
  })
  @IsOptional()
  @IsIn(['custom', 'page', 'post'])
  type?: 'custom' | 'page' | 'post';

  @ApiPropertyOptional({
    description: 'Custom URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @ApiPropertyOptional({
    description: 'Link target',
    enum: ['_self', '_blank'],
  })
  @IsOptional()
  @IsIn(['_self', '_blank'])
  target?: '_self' | '_blank';

  @ApiPropertyOptional({
    description: 'Reference ID (page ID or post ID)',
  })
  @IsOptional()
  @IsInt()
  referenceId?: number | null;

  @ApiPropertyOptional({
    description: 'Menu item translations',
    type: [UpdateMenuItemTranslationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMenuItemTranslationDto)
  translations?: UpdateMenuItemTranslationDto[];
}

/**
 * DTO for updating a menu aggregate
 */
export class UpdateMenuAggregateDto {
  @ApiPropertyOptional({ description: 'Menu title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Menu slug' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Whether the menu is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ✅ ADD THIS
  @ApiPropertyOptional({
    description: 'Menu items',
    type: [UpdateMenuItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMenuItemDto)
  items?: UpdateMenuItemDto[];
}

/**
 * DTO for adding a single menu item
 */
export class AddMenuItemDto {
  @ApiPropertyOptional({
    description: 'Parent menu item ID',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the menu is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Item type',
    enum: ['custom', 'page', 'post'],
    default: 'custom',
  })
  @IsIn(['custom', 'page', 'post'])
  type: 'custom' | 'page' | 'post';

  @ApiPropertyOptional({
    description: 'Custom URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @ApiPropertyOptional({
    description: 'Link target',
    enum: ['_self', '_blank'],
    default: '_self',
  })
  @IsOptional()
  @IsIn(['_self', '_blank'])
  target?: '_self' | '_blank';

  @ApiPropertyOptional({
    description: 'Reference ID',
  })
  @IsOptional()
  @IsInt()
  referenceId?: number | null;

  @ApiPropertyOptional({
    description: 'Menu item translations',
    type: [UpdateMenuItemTranslationDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Menu item must have at least one translation',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateMenuItemTranslationDto)
  translations: UpdateMenuItemTranslationDto[];
}

/**
 * DTO for reordering menu items
 */
export class ReorderMenuItemsDto {
  @ApiPropertyOptional({
    description: 'Items to reorder',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

export class ReorderItemDto {
  @ApiPropertyOptional({
    description: 'Menu item ID',
  })
  @IsInt()
  id: number;

  @ApiPropertyOptional({
    description: 'New order',
  })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiPropertyOptional({
    description: 'New parent ID',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;
}
