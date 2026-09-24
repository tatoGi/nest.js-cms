// src/modules/block-types/dto/block-type-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockTypeResponseDto {
  @ApiProperty({
    description: 'Block type ID',
    example: 1,
    type: 'string',
  })
  id: number;

  @ApiProperty({
    description: 'Unique key identifier',
    example: 'hero-banner',
  })
  key: string;

  @ApiProperty({
    description: 'Human-readable label',
    example: 'Hero Banner',
  })
  label: string;

  @ApiPropertyOptional({
    description: 'Description of the block type',
    example: 'A large banner section with title, subtitle, and call-to-action',
  })
  description: string | null;

  @ApiProperty({
    description: 'Scope (page, post, global)',
    example: 'page',
  })
  scope: string;

  @ApiPropertyOptional({
    description: 'Icon identifier',
    example: 'HeroIcon',
  })
  icon: string | null;

  @ApiProperty({
    description: 'JSON schema defining the block structure',
    example: {
      fields: [
        {
          key: 'title',
          type: 'text',
          label: 'Title',
          required: true,
        },
      ],
    },
  })
  schema: any;

  @ApiPropertyOptional({
    description: 'Default data for new instances',
    example: {
      title: '',
      subtitle: '',
    },
  })
  defaultData: any;

  @ApiProperty({
    description: 'Whether this block type is enabled',
    example: true,
  })
  isEnabled: boolean;

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
