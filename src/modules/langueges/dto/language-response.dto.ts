// src/modules/languages/dto/language-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TextDirection } from '@prisma/client';

export class LanguageResponseDto {
  @ApiProperty({
    description: 'Language ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'ISO language code',
    example: 'ka',
  })
  code: string;

  @ApiProperty({
    description: 'Language name (native)',
    example: 'ქართული',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Language name in English',
    example: 'Georgian',
  })
  englishName?: string | null;

  @ApiPropertyOptional({
    description: 'Language name in Georgian',
    example: 'ქართული',
  })
  georgianName?: string | null;

  @ApiPropertyOptional({
    description: 'Flag emoji',
    example: '🇬🇪',
  })
  flagEmoji?: string | null;

  @ApiProperty({
    description: 'Text direction',
    example: 'ltr',
    enum: ['ltr', 'rtl'],
  })
  direction: TextDirection;

  @ApiProperty({
    description: 'Whether the language is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether this is the default language',
    example: false,
  })
  isDefault: boolean;

  @ApiProperty({
    description: 'Sort order',
    example: 0,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
