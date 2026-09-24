// src/modules/menus/dto/pagination.dto.ts

import { IntersectionType } from '@nestjs/swagger';
import { MenuQueryDto } from './menu-query.dto';
import { PaginationQueryDto } from '@/common/pagination';

export class PagePaginatedQueryDto extends IntersectionType(MenuQueryDto, PaginationQueryDto) {}
