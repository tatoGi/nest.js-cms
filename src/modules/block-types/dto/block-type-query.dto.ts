// src/modules/block-types/dto/block-type-query.dto.ts

import { IsEnum, IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BlockScope } from './create-block-type.dto';

export class BlockTypeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by scope',
    enum: BlockScope,
    example: BlockScope.PAGE,
  })
  @IsEnum(BlockScope, { message: 'Scope must be page, post, or global' })
  @IsOptional()
  scope?: BlockScope;

  @ApiPropertyOptional({
    description: 'Filter by enabled status',
    type: Boolean,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Search term (searches key and label)',
    example: 'hero',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Search term (searches key and label)',
    example: 'hero',
  })
  @IsNumber()
  @IsOptional()
  offset?: number;

  @ApiPropertyOptional({
    description: 'Search term (searches key and label)',
    example: 'hero',
  })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
