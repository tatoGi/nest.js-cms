// src/modules/block-types/dto/create-block-type.dto.ts

import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsObject,
  IsInt,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum BlockScope {
  PAGE = 'page',
  POST = 'post',
  GLOBAL = 'global',
}

export class CreateBlockTypeDto {
  @ApiProperty({
    description: 'Unique key identifier for the block type',
    example: 'hero-banner',
    pattern: '^[a-z0-9-_]+$',
    maxLength: 50,
  })
  @IsString({ message: 'Key must be a string' })
  @MaxLength(50, { message: 'Key must not exceed 50 characters' })
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'Key must contain only lowercase letters, numbers, hyphens, and underscores', // ← Updated message
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  key: string;

  @ApiProperty({
    description: 'Human-readable label for the block type',
    example: 'Hero Banner',
    maxLength: 255,
  })
  @IsString({ message: 'Label must be a string' })
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label: string;

  @ApiPropertyOptional({
    description: 'Description of the block type',
    example: 'A large banner section with title, subtitle, and call-to-action',
    maxLength: 500,
  })
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scope where this block type can be used',
    enum: BlockScope,
    example: BlockScope.PAGE,
  })
  @IsEnum(BlockScope, {
    message: 'Scope must be page, post, or global',
  })
  scope: BlockScope;

  @ApiPropertyOptional({
    description: 'Icon identifier for the block type',
    example: 'HeroIcon',
    maxLength: 100,
  })
  @IsString({ message: 'Icon must be a string' })
  @MaxLength(100, { message: 'Icon must not exceed 100 characters' })
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'JSON schema defining the block structure and fields',
    example: {
      fields: [
        {
          key: 'title',
          type: 'text',
          title: 'Title',
          required: true,
          maxLength: 255,
        },
        {
          key: 'subtitle',
          type: 'text',
          title: 'Subtitle',
          required: false,
          maxLength: 255,
        },
        {
          key: 'backgroundImage',
          type: 'image',
          title: 'Background Image',
          required: true,
        },
        {
          key: 'ctaText',
          type: 'text',
          title: 'CTA Button Text',
          required: false,
          maxLength: 50,
        },
        {
          key: 'ctaUrl',
          type: 'url',
          title: 'CTA Button URL',
          required: false,
        },
      ],
    },
  })
  @IsObject({ message: 'Schema must be a valid JSON object' })
  schema: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Default data for new instances of this block',
    example: {
      title: '',
      subtitle: '',
      backgroundImage: null,
      ctaText: 'Learn More',
      ctaUrl: '',
    },
  })
  @IsObject({ message: 'Default data must be a valid JSON object' })
  @IsOptional()
  defaultData?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether this block type is enabled',
    default: true,
  })
  @IsBoolean({ message: 'IsEnabled must be a boolean' })
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for displaying block types',
    example: 0,
    default: 0,
  })
  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @IsOptional()
  sortOrder?: number;
}
