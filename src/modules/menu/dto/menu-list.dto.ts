// src/modules/menus/dto/menu-list.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MenuItemListTranslationDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  languageId: number;

  @ApiProperty()
  label: string;

  @ApiProperty()
  slug: string;
}

export class MenuItemListDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  menuId: number;

  @ApiPropertyOptional()
  parentId: number | null;

  @ApiPropertyOptional()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({ enum: ['custom', 'page', 'post'] })
  type: 'custom' | 'page' | 'post';

  @ApiPropertyOptional()
  url: string | null;

  @ApiProperty({ enum: ['_self', '_blank'] })
  target: '_self' | '_blank';

  @ApiPropertyOptional()
  referenceId: number | null;

  @ApiProperty({ type: MenuItemListTranslationDto })
  translation: MenuItemListTranslationDto;

  @ApiPropertyOptional({ type: [MenuItemListDto] })
  children?: MenuItemListDto[];
}

export class MenuListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
