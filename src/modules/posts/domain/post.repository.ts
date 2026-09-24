// src/modules/posts/domain/post.repository.ts

import { PaginationOptions } from '@/common/pagination';
import { Post } from './post.aggregate';

export interface PostFilters {
  published?: boolean;
  isFeatured?: boolean;
  authorId?: number;
  searchTerm?: string;
}

export interface CreatePostData {
  authorId?: number | null;
  coverImageId?: number | null;
  published?: boolean;
  isFeatured?: boolean;
  viewCount?: number;
  publishedAt?: Date | null;
}

export interface UpdatePostData {
  authorId?: number | null;
  coverImageId?: number | null;
  published?: boolean;
  isFeatured?: boolean;
  viewCount?: number;
  publishedAt?: Date | null;
}

export interface IPostRepository {
  findAll(filters?: PostFilters, pagination?: PaginationOptions): Promise<Post[]>;
  findById(id: number): Promise<Post | null>;
  findByAuthorId(authorId: number): Promise<Post[]>;
  create(data: CreatePostData): Promise<Post>;
  update(id: number, data: UpdatePostData): Promise<Post>;
  delete(id: number): Promise<void>;
  softDelete(id: number): Promise<void>;
  count(filters?: PostFilters): Promise<number>;
  exists(id: number): Promise<boolean>;
  incrementViewCount(id: number): Promise<void>;
}
