import {
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  MinLength,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFolderDto {
  @ApiProperty({ example: 'Economy Reports' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  parentId?: number;

  @ApiPropertyOptional({ example: 'agriculture' })
  @IsOptional()
  @IsString()
  scope?: string;
}

export class RenameFolderDto {
  @ApiProperty({ example: 'Updated Reports' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class MoveFolderDto {
  @ApiPropertyOptional({ example: 5, description: 'Target parent folder ID. Null = move to root.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  targetParentId?: number | null;
}

export class FolderResponseDto {
  id: number;
  name: string;
  slug: string;
  scope: string;
  order: number;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FolderBreadcrumbDto {
  id: number;
  name: string;
  slug: string;
}

export class BulkMediaIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
