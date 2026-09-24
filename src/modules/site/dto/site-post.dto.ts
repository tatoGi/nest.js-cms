// ─────────────────────────────────────────────────────────────
// File: src/modules/site/dto/site-post.dto.ts
// ─────────────────────────────────────────────────────────────

import { SiteMediaDto } from './site-media.dto';
import { SiteContentBlockDto, SiteCategoryDto, SitePostSummaryDto } from './site-page.dto';

export class SitePostDetailDto {
  id: number;
  slug: string;
  type: string;
  translations: Record<string, string>;
  paths: Record<string, string>;
  title: string;
  excerpt: string | null;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImage: SiteMediaDto | null;
  publishedAt: string | null;
  viewCount: number;
  blocks: SiteContentBlockDto[];
  categories: SiteCategoryDto[];
}

export class SitePostBundleResponseDto {
  // layout: SiteLayoutResponseDto;
  post: SitePostDetailDto;
  relatedPosts: SitePostSummaryDto[];
}

export class SitePagePostBundleResponseDto {
  template: { id: number; slug: string };
  page: { slug: string; translations: Record<string, string>; paths: Record<string, string> };
  post: SitePostDetailDto;
  relatedPosts: SitePostSummaryDto[];
}

export class SiteRedirectDto {
  redirectTo: string;
}
