// src/modules/page-templates/application/page-templates.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { IPageTemplatesRepository } from '../domain/page-templates.repository';
import {
  CreatePageTemplateDto,
  UpdatePageTemplateDto,
  PageTemplateQueryDto,
  PageTemplatePaginatedQueryDto,
} from '../dto';
// import { PaginatedResponseDto } from '@/modules/menu/dto';
import { buildPagination, PaginatedResponseDto } from '@/common/pagination';
import { PageTemplate } from '@prisma/client';
import { PageTemplateDuplicateException, PageTemplateNotFoundException } from '@/common/exceptions';

@Injectable()
export class PageTemplatesService {
  constructor(
    @Inject('IPageTemplatesRepository')
    private readonly repository: IPageTemplatesRepository,
  ) {}

  async create(data: CreatePageTemplateDto) {
    // Check if slug already exists
    const exists = await this.repository.slugExists(data.slug);
    if (exists) {
      throw new PageTemplateDuplicateException(data.slug);
    }

    return this.repository.create(data);
  }

  async findAll(query?: PageTemplateQueryDto) {
    return this.repository.findAll(query);
  }

  async findAllPaginated(query: PageTemplatePaginatedQueryDto) {
    const paginationOptions = buildPagination(query);

    // ✅ Repository call
    const result = await this.repository.findPaginated(query, paginationOptions);
    return new PaginatedResponseDto<PageTemplate>(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  async findById(id: number) {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new PageTemplateNotFoundException(id);
    }
    return template;
  }

  async findBySlug(slug: string) {
    const template = await this.repository.findBySlug(slug);
    if (!template) {
      throw new PageTemplateNotFoundException(slug);
    }
    return template;
  }

  async update(id: number, data: UpdatePageTemplateDto) {
    // Check if template exists
    await this.findById(id);

    // Check if new slug conflicts with existing
    if (data.slug) {
      const exists = await this.repository.slugExists(data.slug, id);
      if (exists) {
        throw new PageTemplateDuplicateException(data.slug);
      }
    }

    return this.repository.update(id, data);
    // return this.repository.update(id, data, userId);
  }

  async delete(id: number) {
    // Check if template exists
    await this.findById(id);

    return this.repository.delete(id);
  }

  async findByCreator(userId: number) {
    return this.repository.findByCreator(userId);
  }

  async findRecentlyUpdated(limit?: number) {
    return this.repository.findRecentlyUpdated(limit);
  }
}
