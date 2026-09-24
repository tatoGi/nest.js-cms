// ─────────────────────────────────────────────────────────────
// File: src/modules/site/dto/site-page.dto.ts
// ─────────────────────────────────────────────────────────────

import { SiteMediaDto } from './site-media.dto';

// ─── Content block (shared for pages and posts) ──────────────

export class SiteContentBlockDto {
  id: number;
  type: string;
  data: Record<string, unknown>;
  sortOrder: number;
}

// ─── Category ────────────────────────────────────────────────

export class SiteCategoryDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

// ─── Post summary (used in page bundles) ─────────────────────

export class SitePostSummaryDto {
  id: number;
  slug: string;
  type: string;
  paths: Record<string, string>;
  title: string;
  excerpt: string | null;
  coverImage: SiteMediaDto | null;
  publishedAt: string | null;
  categories: SiteCategoryDto[];
  blocks: SiteContentBlockDto[];
}

// ─── Grouped posts ───────────────────────────────────────────

export class SitePostsGroupedDto {
  categories: SiteCategoryDto[];
  grouped: Record<string, SitePostSummaryDto[]>;
}

// ─── Page ────────────────────────────────────────────────────

export class SitePageDto {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  focusKeyword: string | null;
  canonicalUrl: string | null;
  featureImage: SiteMediaDto | null;
  isHome: boolean;
  translations: Record<string, string>;
  paths: Record<string, string>;
  template: {
    id: number;
    slug: string;
  };
  blocks: SiteContentBlockDto[];
}

// ─── Page bundle (full aggregated response) ──────────────────

export class SitePageBundleResponseDto {
  // layout: SiteLayoutResponseDto;
  page: SitePageDto;
  posts: SitePostsGroupedDto;
}
