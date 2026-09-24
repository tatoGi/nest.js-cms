// ─────────────────────────────────────────────────────────────
// File: src/modules/media/dto/upload-media.dto.ts
// ─────────────────────────────────────────────────────────────

import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsPositive,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for upload metadata sent alongside the file.
 * The actual file comes via Multer multipart, not JSON body.
 */
export class UploadMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  folder?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  folderId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}

/**
 * DTO for updating media metadata (not the file itself).
 */
export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  folder?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  folderId?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}

/**
 * DTO for creating a new media folder.
 */
export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Only letters, numbers, hyphens and underscores allowed',
  })
  name: string;
}
