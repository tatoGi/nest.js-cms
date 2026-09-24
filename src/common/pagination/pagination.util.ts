// src/common/pagination/pagination.util.ts

import { PaginationQueryDto } from './pagination-query.dto';

export function buildPagination(query: PaginationQueryDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder ?? 'asc',
  };
}
