// src/modules/languages/dto/language-query.dto.ts

import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LanguageQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by language code',
    example: 'en',
  })
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    type: Boolean,
    example: true,
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by default language',
    type: Boolean,
    example: false,
  })
  @IsBoolean({ message: 'isDefault must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by text direction',
    enum: ['ltr', 'rtl'],
    example: 'ltr',
  })
  @IsIn(['ltr', 'rtl'], {
    message: 'Direction must be either ltr or rtl',
  })
  @IsOptional()
  direction?: 'ltr' | 'rtl';

  @ApiPropertyOptional({
    description: 'Search term (searches code, name, englishName, and georgianName)',
    example: 'eng',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  searchTerm?: string;
}
