import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export class PermissionQueryDto {
  @ApiPropertyOptional({ example: 'pages' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'pages', description: 'Filter by group' })
  @IsString()
  @IsOptional()
  group?: string;
}

export class PermissionPaginatedQueryDto extends IntersectionType(
  PaginationQueryDto,
  PermissionQueryDto,
) {}
