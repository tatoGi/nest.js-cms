// src/modules/posts/domain/post-translation.repository.ts

export interface DbPostTranslation {
  id: number;
  postId: number;
  languageId: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostTranslationFilters {
  postId?: number;
  languageId?: number;
  slug?: string;
}

export interface CreatePostTranslationData {
  postId: number;
  languageId: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface UpdatePostTranslationData {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface IPostTranslationRepository {
  findAll(filters?: PostTranslationFilters): Promise<DbPostTranslation[]>;
  findById(id: number): Promise<DbPostTranslation | null>;
  findByPostAndLanguage(postId: number, languageId: number): Promise<DbPostTranslation | null>;
  findBySlug(slug: string): Promise<DbPostTranslation | null>;
  create(data: CreatePostTranslationData): Promise<DbPostTranslation>;
  update(id: number, data: UpdatePostTranslationData): Promise<DbPostTranslation>;
  upsert(
    postId: number,
    languageId: number,
    data: CreatePostTranslationData,
  ): Promise<DbPostTranslation>;
  delete(id: number): Promise<void>;
  deleteByPostId(postId: number): Promise<void>;
  isSlugUnique(slug: string, excludeTranslationId?: number): Promise<boolean>;
}
