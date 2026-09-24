import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export class RoleQueryDto {
  @ApiPropertyOptional({ example: 'editor' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class RolePaginatedQueryDto extends IntersectionType(PaginationQueryDto, RoleQueryDto) {}
