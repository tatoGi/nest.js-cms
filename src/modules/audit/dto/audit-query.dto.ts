import { IsOptional, IsInt, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';

export class AuditQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by actor (user who performed the action)',
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  actorId?: number;

  @ApiPropertyOptional({ example: 'user.created' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: 'user' })
  @IsString()
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  targetId?: number;
}

export class AuditPaginatedQueryDto extends IntersectionType(PaginationQueryDto, AuditQueryDto) {}
