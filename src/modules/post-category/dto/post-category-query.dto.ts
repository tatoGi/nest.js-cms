import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import { IntersectionType } from '@nestjs/swagger';

export class PostCategoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number | null;

  @IsOptional()
  @IsString()
  languageCode?: string;
}

export class PagePaginatedQueryDto extends IntersectionType(
  PostCategoryQueryDto,
  PaginationQueryDto,
) {}
