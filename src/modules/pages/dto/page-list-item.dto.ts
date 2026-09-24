// src/modules/pages/dto/page-list.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaEmbedDto } from '@/modules/media/dto';
import { Language, PageTemplate } from '@prisma/client';

export class PageListTranslationDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  languageId: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  language: Language | null;
}

export class PageListItemDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  parentId?: number | null;

  @ApiProperty()
  templateId: number;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  published: boolean;

  @ApiProperty()
  showInMenu: boolean;

  @ApiProperty()
  isHome: boolean;

  @ApiPropertyOptional()
  featureImageId?: number | null;

  @ApiPropertyOptional({ type: MediaEmbedDto })
  featureImage?: MediaEmbedDto | null;

  @ApiProperty({ type: PageListTranslationDto })
  translation: PageListTranslationDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  deletedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Template data',
    nullable: true,
  })
  templateData: PageTemplate | null;
}
