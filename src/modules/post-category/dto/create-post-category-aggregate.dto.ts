import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PostCategoryTranslationDto {
  @IsInt()
  languageId: number;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePostCategoryAggregateDto {
  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostCategoryTranslationDto)
  translations: PostCategoryTranslationDto[];
}
