// ─────────────────────────────────────────────────────────────
// File: src/modules/media/dto/media-query.dto.ts
// ─────────────────────────────────────────────────────────────

import { IsOptional, IsString, IsIn, IsInt, IsPositive, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export class MediaPaginatedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  folderId?: number;

  /**
   * Logical file type group.
   * "image" → jpeg, png, gif, webp, svg
   * "video" → mp4, webm
   * "document" → pdf
   */
  @IsOptional()
  @IsIn(['image', 'video', 'document'])
  type?: 'image' | 'video' | 'document';

  @IsOptional()
  @IsString()
  mimeType?: string;

  /** Pass ?deleted=true to list soft-deleted (trash) media */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  deleted?: boolean;
}
