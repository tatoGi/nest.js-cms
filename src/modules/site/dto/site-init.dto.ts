// ─────────────────────────────────────────────────────────────
// File: src/modules/site/dto/site-init.dto.ts
// ─────────────────────────────────────────────────────────────

export class SiteLanguageDto {
  id: number;
  code: string;
  name: string;
  englishName: string | null;
  georgianName: string | null;
  flagEmoji: string | null;
  direction: string;
  isDefault: boolean;
  sortOrder: number;
}

/**
 * Settings now returned grouped and flattened.
 *
 * Example:
 * {
 *   footer: {
 *     footer_address: "თბილისი"
 *   },
 *   seo: {
 *     seo_default_title: "Enterprise Georgia"
 *   }
 * }
 */
export type SiteSettingsGroupedDto = Record<string, Record<string, unknown>>;

export class SiteInitResponseDto {
  languages: SiteLanguageDto[];
  defaultLanguage: SiteLanguageDto | null;
  /** Home page slug per locale: { ka: "მთავარი", en: "home" } */
  homeSlugs: Record<string, string>;
}
