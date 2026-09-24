import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/pagination';
import { PageTemplateQueryDto } from './page-template-query.dto';

export class PageTemplatePaginatedQueryDto extends IntersectionType(
  PageTemplateQueryDto,
  PaginationQueryDto,
) {}
