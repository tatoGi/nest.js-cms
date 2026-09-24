// backend/src/modules/languages/dto/create-language.dto.ts

import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateLanguageDto {
  @ApiProperty({
    description: 'ISO language code',
    example: 'en',
    maxLength: 8,
  })
  @IsString({ message: 'Code must be a string' })
  @MaxLength(8, { message: 'Code must not exceed 8 characters' })
  @Matches(/^[a-zA-Z-]+$/, {
    message: 'Code must contain only letters and hyphens',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  code: string;

  @ApiProperty({
    description: 'Language name (native form)',
    example: 'ქართული',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Language name in English',
    example: 'Georgian',
    maxLength: 100,
  })
  @IsString({ message: 'English name must be a string' })
  @MaxLength(100, { message: 'English name must not exceed 100 characters' })
  @IsOptional()
  englishName?: string;

  @ApiPropertyOptional({
    description: 'Language name in Georgian',
    example: 'ქართული',
    maxLength: 100,
  })
  @IsString({ message: 'Georgian name must be a string' })
  @MaxLength(100, { message: 'Georgian name must not exceed 100 characters' })
  @IsOptional()
  georgianName?: string;

  @ApiPropertyOptional({
    description: 'Flag emoji',
    example: '🇬🇪',
    maxLength: 10,
  })
  @IsString({ message: 'Flag emoji must be a string' })
  @MaxLength(10, { message: 'Flag emoji must not exceed 10 characters' })
  @IsOptional()
  flagEmoji?: string;

  @ApiPropertyOptional({
    description: 'Text direction',
    example: 'ltr',
    enum: ['ltr', 'rtl'],
    default: 'ltr',
  })
  @IsIn(['ltr', 'rtl'], {
    message: 'Direction must be either ltr or rtl',
  })
  @IsOptional()
  direction?: 'ltr' | 'rtl';

  @ApiPropertyOptional({
    description: 'Whether the language is active',
    default: true,
  })
  @IsBoolean({ message: 'IsActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is the default language',
    default: false,
  })
  @IsBoolean({ message: 'IsDefault must be a boolean' })
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 0,
    default: 0,
  })
  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @IsOptional()
  sortOrder?: number;
}
