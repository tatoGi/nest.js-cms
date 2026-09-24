// src/modules/posts/domain/post-block.repository.ts

export interface DbPostContentBlock {
  id: number;
  translationId: number;
  type: string;
  data: Record<string, any>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostBlockFilters {
  translationId?: number;
  type?: string;
}

export interface CreatePostBlockData {
  translationId: number;
  type: string;
  data: Record<string, any>;
  sortOrder: number;
}

export interface UpdatePostBlockData {
  type?: string;
  data?: Record<string, any>;
  sortOrder?: number;
}

export interface IPostBlockRepository {
  findAll(filters?: PostBlockFilters): Promise<DbPostContentBlock[]>;
  findById(id: number): Promise<DbPostContentBlock | null>;
  findByTranslationId(translationId: number): Promise<DbPostContentBlock[]>;
  create(data: CreatePostBlockData): Promise<DbPostContentBlock>;
  createMany(data: CreatePostBlockData[]): Promise<DbPostContentBlock[]>;
  update(id: number, data: UpdatePostBlockData): Promise<DbPostContentBlock>;
  upsert(id: number | undefined, data: CreatePostBlockData): Promise<DbPostContentBlock>;
  delete(id: number): Promise<void>;
  deleteByTranslationId(translationId: number): Promise<void>;
  reorder(translationId: number, blockIds: number[]): Promise<void>;
}
