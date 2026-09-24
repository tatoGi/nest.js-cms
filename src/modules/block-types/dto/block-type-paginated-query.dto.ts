import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import { BlockTypeQueryDto } from './block-type-query.dto';

export class BlockTypePaginatedQueryDto extends IntersectionType(
  PaginationQueryDto,
  BlockTypeQueryDto,
) {}
