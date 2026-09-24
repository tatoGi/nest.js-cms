// src/modules/posts/domain/post.aggregate.ts

import { MediaEmbedDto } from '@/modules/media/dto';
// Prisma 7 dropped the '@prisma/client/runtime/library' subpath; JsonValue is
// re-exported from the generated Prisma namespace instead.
import { Language, Prisma } from '@prisma/client';

type JsonValue = Prisma.JsonValue;

// ==========================================
// POST TYPE
// ==========================================

export enum PostTypeEnum {
  NEWS = 'news',
  SUCCESS = 'success',
  COURSE = 'course',
}

export type PostTypeValue = 'news' | 'success' | 'course';

// ==========================================
// POST BASE ENTITY
// ==========================================

export interface Post {
  id: number;
  type: PostTypeValue;
  authorId: number | null;
  coverImageId: number | null;
  coverImage?: MediaEmbedDto | null;

  published: boolean;
  isFeatured: boolean;

  viewCount: number;
  publishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  deletedAt?: Date | null;
}

// ==========================================
// POST TRANSLATION
// ==========================================

export interface PostTranslation {
  id?: number;
  postId?: number;

  languageId: number;

  title: string;
  slug: string;

  excerpt: string | null;
  content: string | null;

  metaTitle: string | null;
  metaDescription: string | null;

  createdAt?: Date;
  updatedAt?: Date;

  blocks: PostContentBlock[];
}

// ==========================================
// POST CONTENT BLOCK
// ==========================================

export interface PostContentBlock {
  id?: number;
  translationId?: number;

  type: string;
  data: Record<string, any>;

  sortOrder: number;

  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// SLUG ALIASES
// ==========================================

export interface PostSlugAlias {
  id?: number;
  postId?: number;

  languageId: number;
  slug: string;

  createdAt?: Date;
}

// ==========================================
// ✅ POST VERSIONING (Prisma Compatible)
// ==========================================

export interface PostVersion {
  id: number;
  postId: number;
  languageId: number;
  language?: Partial<Language>;
  snapshot: JsonValue;
  createdAt: Date;
}

// ==========================================
// POST PAGE RELATION
// ==========================================

export interface PostPage {
  id: number;
  title: string;
  slug: string;
}

// ==========================================
// POST AGGREGATE ROOT
// ==========================================

export interface PostAggregate extends Omit<Post, 'id'> {
  id?: number;

  translations: PostTranslation[];

  slugAliases?: PostSlugAlias[];

  versions?: PostVersion[] | undefined;

  author?: {
    id: number;
    displayName: string;
    email: string;
  } | null;

  pages?: PostPage[];
  pageIds?: number[];
  categoryIds?: number[];
  categories?: {
    id: number;
    slug: string;
  }[];
}
