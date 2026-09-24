// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/domain/settings.repository.ts
// ─────────────────────────────────────────────────────────────

import { PaginatedResult, PaginationOptions } from '@/common/pagination';
import type { Setting, SettingLocalizedContent, SettingGlobalContent } from '@prisma/client';
import { SettingFilters } from '../dto';

// ─── Composite types ─────────────────────────────────────────

export type SettingWithRelations = Setting & {
  settingLocalizedContent: SettingLocalizedContent[];
  settingGlobalContent: SettingGlobalContent | null;
};

export type CreateSettingData = {
  key: string;
  label: string;
  description?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
};

export type UpdateSettingData = Partial<Omit<CreateSettingData, 'key' | 'isTranslatable'>>;

// ─── Abstract repository ─────────────────────────────────────

export abstract class SettingsRepository {
  // ─── Read ──────────────────────────────────────────────────
  abstract findById(id: number): Promise<SettingWithRelations | null>;
  abstract findByKey(key: string): Promise<SettingWithRelations | null>;
  abstract findAll(): Promise<SettingWithRelations[]>;
  abstract findPaginated(
    filters?: SettingFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<SettingWithRelations>>;
  abstract findPublicActive(languageId: number): Promise<SettingWithRelations[]>;

  // ─── Write (Setting) ──────────────────────────────────────
  abstract create(data: CreateSettingData): Promise<SettingWithRelations>;
  abstract update(id: number, data: UpdateSettingData): Promise<SettingWithRelations>;
  abstract delete(id: number): Promise<void>;

  // ─── Write (Value — non-translatable) ─────────────────────
  abstract upsertsettingGlobalContent(settingId: number, value: any): Promise<SettingGlobalContent>;

  // ─── Write (Translation — translatable) ───────────────────
  abstract upsertLocalizedContent(
    settingId: number,
    languageId: number,
    value: any,
  ): Promise<SettingLocalizedContent>;
}
