// src/modules/menus/dto/menu-aggregate-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for menu item translation
 */
export class MenuItemTranslationResponseDto {
  @ApiProperty({
    description: 'Translation ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Menu item ID',
    example: 1,
  })
  menuItemId: number;

  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  languageId: number;

  @ApiProperty({
    description: 'Menu item label',
    example: 'Home',
  })
  label: string;

  @ApiProperty({
    description: 'Menu item slug',
    example: '/home',
  })
  slug: string;
}

/**
 * Response DTO for menu item
 */
export class MenuItemResponseDto {
  @ApiProperty({
    description: 'Menu item ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Menu ID',
    example: 1,
  })
  menuId: number;

  @ApiProperty({
    description: 'active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Parent menu item ID',
  })
  parentId: number | null;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
  })
  order: number;

  @ApiProperty({
    description: 'Item type',
    enum: ['custom', 'page', 'post'],
  })
  type: 'custom' | 'page' | 'post';

  @ApiPropertyOptional({
    description: 'Custom URL',
  })
  url: string | null;

  @ApiProperty({
    description: 'Link target',
    enum: ['_self', '_blank'],
  })
  target: '_self' | '_blank';

  @ApiPropertyOptional({
    description: 'Reference ID',
  })
  referenceId: number | null;

  @ApiProperty({
    description: 'Menu item translations',
    type: [MenuItemTranslationResponseDto],
  })
  translations: MenuItemTranslationResponseDto[];

  @ApiPropertyOptional({
    description: 'Child menu items',
    type: [MenuItemResponseDto],
  })
  children?: MenuItemResponseDto[];

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

/**
 * Response DTO for complete menu aggregate
 */
export class MenuAggregateResponseDto {
  @ApiProperty({
    description: 'Menu ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Menu title',
    example: 'Main Navigation',
  })
  title: string;

  @ApiProperty({
    description: 'Menu slug',
    example: 'main-navigation',
  })
  slug: string;

  @ApiProperty({
    description: 'Whether the menu is active',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Menu items',
    type: [MenuItemResponseDto],
  })
  items?: MenuItemResponseDto[];

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
