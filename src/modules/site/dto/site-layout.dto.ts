// ─────────────────────────────────────────────────────────────
// File: src/modules/site/dto/site-layout.dto.ts
// ─────────────────────────────────────────────────────────────

/**
 * ==========================================
 * MENU DTOs
 * ==========================================
 */

export class SiteMenuItemDto {
  id: number;
  type: string;

  url: string | null;
  target: string;

  label: string;
  slug: string;

  sortOrder: number;
  referenceId: number | null;

  children: SiteMenuItemDto[];
}

export class SiteMenuDto {
  id: number;
  title: string;
  slug: string;

  items: SiteMenuItemDto[];
}

export type SiteSettingsGroupDto = Record<string, unknown>;

export type SiteLayoutSettingsDto = Record<string, Record<string, unknown>>;

export class SiteLayoutResponseDto {
  menus: SiteMenuDto[];
  settings: SiteLayoutSettingsDto;
}
