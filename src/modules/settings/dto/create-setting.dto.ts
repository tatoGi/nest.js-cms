// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/dto/create-setting.dto.ts
// ─────────────────────────────────────────────────────────────

import { IsString, IsBoolean, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettingDto {
  @ApiProperty({
    description: 'Unique setting key (snake_case)',
    example: 'footer_address',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Key must be snake_case (lowercase letters, numbers, underscores)',
  })
  key: string;

  @ApiProperty({
    description: 'Human-readable label',
    example: 'Footer Address',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiPropertyOptional({
    description: 'Description of the setting',
    example: 'The physical address shown in the footer',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this setting is visible on the public site',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this setting is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
