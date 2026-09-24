import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export class PostCategoryPaginatedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) =>
    value !== undefined && value !== null ? parseInt(value, 10) : undefined,
  )
  parentId?: number | null;

  @IsOptional()
  @IsString()
  languageCode?: string;
}
