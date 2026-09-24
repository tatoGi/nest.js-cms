// src/modules/pages/dto/page-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PageQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by published status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  published?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by show in menu',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  showInMenu?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by homepage status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isHome?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by parent page ID',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number;

  @ApiPropertyOptional({
    description: 'Filter by language ID',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  languageId?: number;

  @ApiPropertyOptional({
    description: 'Filter by template ID',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  templateId?: number;

  // ✅ ADD THIS
  @ApiPropertyOptional({
    description: 'Search by title, slug or content',
  })
  @IsOptional()
  search?: string;
}
