// src/modules/posts/dto/post-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PostQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by published status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  published?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by featured status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by author ID',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  authorId?: number;

  @ApiPropertyOptional({
    description: 'Filter by language ID',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  languageId?: number;

  @ApiPropertyOptional({
    description: 'Search term for title/content',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
