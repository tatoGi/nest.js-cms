// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/dto/setting-paginated-query.dto.ts
// ─────────────────────────────────────────────────────────────

import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export type SettingFilters = {
  search?: string;
  isActive?: boolean;
  isPublic?: boolean;
};

export class SettingPaginatedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublic?: boolean;
}
