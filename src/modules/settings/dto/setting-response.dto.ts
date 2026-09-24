// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/dto/setting-response.dto.ts
// ─────────────────────────────────────────────────────────────

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Translation response ────────────────────────────────────

export class SettingLocalizedContentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  languageId: number;

  @ApiProperty()
  value: Record<string, unknown>;
}

// ─── Value response ──────────────────────────────────────────

export class SettingsettingGlobalContentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  value: Record<string, unknown>;
}

// ─── Single setting response ─────────────────────────────────

export class SettingResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [SettingLocalizedContentResponseDto] })
  settingLocalizedContent: SettingLocalizedContentResponseDto[];

  @ApiProperty({ type: [SettingsettingGlobalContentResponseDto] })
  settingGlobalContent: SettingsettingGlobalContentResponseDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

// ─── Grouped response (admin list) ───────────────────────────

export type SettingsGroupedResponseDto = Record<string, SettingResponseDto[]>;

// ─── Public flattened response ───────────────────────────────

export type SettingsPublicResponseDto = Record<string, any>;
