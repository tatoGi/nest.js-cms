// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/application/settings.service.ts
// ─────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { SettingsRepository, SettingWithRelations } from '../domain/settings.repository';
import {
  CreateSettingDto,
  UpdateSettingDto,
  UpdateSettingsettingGlobalContentDto,
  UpdateSettingLocalizedContentDto,
  SettingResponseDto,
  SettingLocalizedContentResponseDto,
  SettingsettingGlobalContentResponseDto,
  SettingsPublicResponseDto,
  SettingPaginatedQueryDto,
  SettingFilters,
} from '../dto';
import { PaginatedResponseDto, PaginationOptions } from '@/common/pagination';
import { SettingsNotFoundException, SettingsDuplicateException } from '@/common/exceptions';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { SettingsPermissions } from './settings.permissions';

// ─── Cache entry ─────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  // In-memory cache: key = languageId, TTL = 60s
  private publicCache = new Map<number, CacheEntry<SettingsPublicResponseDto>>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly repository: SettingsRepository,
    private readonly auditService: AuditService,
  ) {}

  // ==================================================
  // ADMIN — CRUD
  // ==================================================

  /**
   * Create a new setting definition.
   * Key must be unique (snake_case).
   */
  async create(dto: CreateSettingDto, meta?: ActionMeta): Promise<SettingResponseDto> {
    const existing = await this.repository.findByKey(dto.key);
    if (existing) {
      throw new SettingsDuplicateException(dto.key);
    }

    const setting = await this.repository.create({
      key: dto.key,
      label: dto.label,
      description: dto.description,
      isPublic: dto.isPublic,
      isActive: dto.isActive,
    });

    this.invalidateCache();
    await this.auditService.log({
      actorId: meta?.actorId,
      action: SettingsPermissions.CREATE_SETTING,
      targetType: 'setting',
      targetId: setting.id,
      after: {
        key: setting.key,
        label: setting.label,
        isPublic: setting.isPublic,
        isActive: setting.isActive,
      },
      ip: meta?.ip,
    });
    return this.mapToResponse(setting);
  }

  /**
   * Update setting metadata (label, description, flags).
   */
  async update(id: number, dto: UpdateSettingDto, meta?: ActionMeta): Promise<SettingResponseDto> {
    const before = await this.findByIdOrThrow(id);

    const setting = await this.repository.update(id, {
      label: dto.label,
      description: dto.description,
      isPublic: dto.isPublic,
      isActive: dto.isActive,
    });

    this.invalidateCache();
    await this.auditService.log({
      actorId: meta?.actorId,
      action: SettingsPermissions.UPDATE_SETTING,
      targetType: 'setting',
      targetId: id,
      before: { label: before.label, isPublic: before.isPublic, isActive: before.isActive },
      after: { label: setting.label, isPublic: setting.isPublic, isActive: setting.isActive },
      ip: meta?.ip,
    });
    return this.mapToResponse(setting);
  }

  /**
   * Delete a setting and all its content (cascade).
   */
  async delete(id: number, meta?: ActionMeta): Promise<void> {
    const setting = await this.findByIdOrThrow(id);
    await this.repository.delete(id);
    this.invalidateCache();
    await this.auditService.log({
      actorId: meta?.actorId,
      action: SettingsPermissions.DELETE_SETTING,
      targetType: 'setting',
      targetId: id,
      before: { key: setting.key, label: setting.label },
      ip: meta?.ip,
    });
  }

  /**
   * List all settings with their content.
   * Returns flat array — frontend handles grouping if needed.
   */
  async findAll(): Promise<SettingResponseDto[]> {
    const settings = await this.repository.findAll();
    return settings.map((s) => this.mapToResponse(s));
  }

  async findAllPaginated(
    query: SettingPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<SettingResponseDto>> {
    const filters: SettingFilters = {
      search: query.search,
      isActive: query.isActive,
      isPublic: query.isPublic,
    };

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.repository.findPaginated(filters, paginationOptions);

    return new PaginatedResponseDto<SettingResponseDto>(
      result.data.map((s) => this.mapToResponse(s)),
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  /**
   * Get single setting by ID (admin).
   */
  async findById(id: number): Promise<SettingResponseDto> {
    const setting = await this.findByIdOrThrow(id);
    return this.mapToResponse(setting);
  }

  // ==================================================
  // ADMIN — Global content (non-translatable value)
  // ==================================================

  /**
   * Set/update the global (non-localized) value for a setting.
   * Uses upsert — creates if not exists, updates if exists.
   */
  async updatesettingGlobalContent(
    id: number,
    dto: UpdateSettingsettingGlobalContentDto,
    meta?: ActionMeta,
  ): Promise<SettingResponseDto> {
    const before = await this.findByIdOrThrow(id);

    await this.repository.upsertsettingGlobalContent(id, dto.value);

    this.invalidateCache();

    const updated = await this.findByIdOrThrow(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: SettingsPermissions.UPDATE_SETTING,
      targetType: 'setting',
      targetId: id,
      before: { key: before.key, value: before.settingGlobalContent?.value },
      after: { key: before.key, value: dto.value },
      ip: meta?.ip,
    });
    return this.mapToResponse(updated);
  }

  // ==================================================
  // ADMIN — Localized content (per-language value)
  // ==================================================

  /**
   * Set/update a localized value for a setting + language pair.
   * Uses upsert on the (settingId, languageId) unique constraint.
   */
  async updateLocalizedContent(
    id: number,
    languageId: number,
    dto: UpdateSettingLocalizedContentDto,
    meta?: ActionMeta,
  ): Promise<SettingResponseDto> {
    const before = await this.findByIdOrThrow(id);

    await this.repository.upsertLocalizedContent(id, languageId, dto.value);

    this.invalidateCache();

    const updated = await this.findByIdOrThrow(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: SettingsPermissions.UPDATE_SETTING,
      targetType: 'setting',
      targetId: id,
      after: { key: before.key, languageId, value: dto.value },
      ip: meta?.ip,
    });
    return this.mapToResponse(updated);
  }

  // ==================================================
  // PUBLIC — Aggregated flattened response
  // ==================================================

  /**
   * Returns a flattened key → value map for all public active settings.
   *
   * Resolution logic per setting:
   *   1. If a localizedContent exists for the requested languageId → use it
   *   2. Otherwise if settingGlobalContent exists → use it
   *   3. Otherwise → null
   *
   * Example response:
   * {
   *   "site_title": { "value": "Enterprise Georgia" },
   *   "footer_address": { "value": "თბილისი" },
   *   "contact_email": { "value": "info@test.ge" }
   * }
   *
   * Cached for 60 seconds per languageId.
   */
  async getPublicSettings(languageId: number): Promise<SettingsPublicResponseDto> {
    // Check cache
    const cached = this.publicCache.get(languageId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const settings = await this.repository.findPublicActive(languageId);

    const result: SettingsPublicResponseDto = {};

    for (const setting of settings) {
      // Prefer localized content for the requested language
      const localized = setting.settingLocalizedContent?.[0] ?? null;
      if (localized) {
        result[setting.key] = localized.value;
      } else {
        // Fall back to global content
        result[setting.key] = setting.settingGlobalContent?.value ?? null;
      }
    }

    // Cache
    this.publicCache.set(languageId, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }

  // ==================================================
  // CACHE
  // ==================================================

  invalidateCache(): void {
    this.publicCache.clear();
    this.logger.log('Settings cache invalidated');
  }

  // ==================================================
  // PRIVATE — Helpers
  // ==================================================

  private async findByIdOrThrow(id: number): Promise<SettingWithRelations> {
    const setting = await this.repository.findById(id);
    if (!setting) {
      throw new SettingsNotFoundException(id);
    }
    return setting;
  }

  // ==================================================
  // PRIVATE — Mappers
  // ==================================================

  private mapToResponse(setting: SettingWithRelations): SettingResponseDto {
    return {
      id: setting.id,
      key: setting.key,
      label: setting.label,
      description: setting.description,
      isPublic: setting.isPublic,
      isActive: setting.isActive,
      settingGlobalContent: setting.settingGlobalContent
        ? this.mapsettingGlobalContent(setting.settingGlobalContent)
        : null,
      settingLocalizedContent: setting.settingLocalizedContent.map(this.mapLocalizedContent),
      createdAt: setting.createdAt.toISOString(),
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  private mapsettingGlobalContent = (
    gc: NonNullable<SettingWithRelations['settingGlobalContent']>,
  ): SettingsettingGlobalContentResponseDto => ({
    id: gc.id,
    value: gc.value as Record<string, unknown>,
  });

  private mapLocalizedContent = (
    lc: SettingWithRelations['settingLocalizedContent'][0],
  ): SettingLocalizedContentResponseDto => ({
    id: lc.id,
    languageId: lc.languageId,
    value: lc.value as Record<string, unknown>,
  });
}
