// src/modules/menus/dto/menu-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class MenuQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by slug',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Search term',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include menu items',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeItems?: boolean;
}

export class MenuItemQueryDto {
  @ApiPropertyOptional({
    description: 'Language ID for translations',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  languageId?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Return nested structure',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  nested?: boolean;
}
