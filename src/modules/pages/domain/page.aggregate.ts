// src/modules/pages/domain/page.aggregate.ts
import { MediaEmbedDto } from '@/modules/media/dto';
// Prisma 7 dropped the '@prisma/client/runtime/library' subpath; JsonValue is
// re-exported from the generated Prisma namespace instead.
import { Language, PageTemplate, Prisma } from '@prisma/client';

type JsonValue = Prisma.JsonValue;

export interface PageBlock {
  id?: number;
  type: string;
  data: Record<string, any>;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PageTranslation {
  id?: number;
  languageId: number;
  title: string;
  slug: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  publishedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  blocks: PageBlock[];
  language?: Language | null;
}

export interface PageSlugAlias {
  id?: number;
  pageId?: number;
  languageId: number;
  slug: string;
  createdAt?: Date;
}

export interface PageVersion {
  id: number;
  pageId: number;
  languageId: number;
  language?: Language;
  snapshot: JsonValue;
  createdAt: Date | null;
}

export interface PageAggregate {
  id?: number;
  parentId?: number | null;
  templateId: number;
  sortOrder: number;
  published: boolean;
  showInMenu: boolean;
  isHome: boolean;
  featureImageId?: number | null;
  featureImage?: MediaEmbedDto | null;

  // Audit fields
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;

  // Relations
  translations: PageTranslation[];
  slugAliases?: PageSlugAlias[];
  versions?: PageVersion[];

  // Computed/joined data
  templateData?: PageTemplate | null;
  parent?: PageAggregate | null;
  children?: PageAggregate[];
}
