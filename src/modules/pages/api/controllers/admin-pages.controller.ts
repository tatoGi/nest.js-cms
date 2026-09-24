// src/modules/pages/api/controllers/admin-pages.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';

import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

import { PagesService } from '../../application/page.service';
import { PagesPermissions } from '../../application/pages.permissions';

import {
  CreatePageAggregateDto,
  UpdatePageAggregateDto,
  PageAggregateResponseDto,
  PageQueryDto,
  PageListItemDto,
} from '../../dto';

import { PagePaginatedQueryDto } from '../../dto/pagination.dto';

import { PageMapper } from '../mappers/page.mapper';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';
import { ApiIdParam, ApiStandardResponses } from '@/common/decorators/api-decorators';
import { Locale } from '@/common/decorators/locale.decorator';
import { PaginatedResponseDto } from '@/common/pagination';
import { PageVersion } from '../../domain';
import { AuthRequest } from '@/modules/auth/interface/auth-request.interface';

@ApiTags('Admin - Pages')
@Controller('admin/pages')
@UseInterceptors(CacheInterceptor('pages'))
@ApiStandardResponses()
export class AdminPagesController {
  constructor(private readonly pagesService: PagesService) {}

  // ==================================================
  // CREATE
  // ==================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PagesPermissions.CREATE_PAGES)
  @ApiOperation({
    summary: 'Create page with translations and blocks',
  })
  @ApiCreatedResponse({ type: PageAggregateResponseDto })
  async create(
    @Body() dto: CreatePageAggregateDto,
    @Req() req: Request,
  ): Promise<PageAggregateResponseDto> {
    const aggregate = PageMapper.toAggregate(dto);
    const created = await this.pagesService.createAggregate(aggregate, undefined, getMeta(req));
    return PageMapper.toResponse(created);
  }

  // ==================================================
  // LIST + PAGINATION
  // ==================================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Get pages list',
  })
  @ApiOkResponse({ type: [PageListItemDto] })
  async findAll(
    @Query() query: PageQueryDto,
    @Locale() languageId: number,
  ): Promise<PageListItemDto[]> {
    return this.pagesService.findAllList(query, languageId);
  }

  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Get pages list with pagination',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: PagePaginatedQueryDto,
    @Locale() languageId: number,
  ): Promise<PaginatedResponseDto<PageListItemDto>> {
    return this.pagesService.findAllListPaginated(query, languageId);
  }

  // ==================================================
  // SLUGS
  // ==================================================

  @Get('slugs')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({ summary: 'Get all published page slugs' })
  @ApiOkResponse({
    schema: { type: 'array', items: { type: 'string', example: 'about-us' } },
  })
  async getAllSlugs(@Locale() languageId: number): Promise<string[]> {
    return this.pagesService.findAllPublishedSlugs(languageId);
  }

  // ==================================================
  // TRASH SYSTEM (Static Routes BEFORE :id)
  // ==================================================

  @Get('trash')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Get trashed pages',
  })
  @ApiOkResponse({ type: [PageListItemDto] })
  async getTrash(@Locale() languageId: number): Promise<PageListItemDto[]> {
    return this.pagesService.getDeletedPages(languageId);
  }

  // ==================================================
  // SINGLE PAGE
  // ==================================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Get page by ID',
  })
  @ApiIdParam('id', 'Page ID')
  @ApiOkResponse({ type: PageAggregateResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<PageAggregateResponseDto> {
    const page = await this.pagesService.findAggregateById(id);
    return PageMapper.toResponse(page);
  }

  @Get('by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Get page by slug',
  })
  async findBySlug(
    @Param('slug') slug: string,
    @Locale() languageId: number,
  ): Promise<PageAggregateResponseDto> {
    const page = await this.pagesService.findAggregateBySlug(slug, languageId);
    return PageMapper.toResponse(page);
  }

  @Get(':id/children')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({ summary: 'Get child pages' })
  async findChildren(
    @Param('id', ParseIntPipe) id: number,
    @Locale() languageId: number,
  ): Promise<PageListItemDto[]> {
    return this.pagesService.findChildrenList(id, languageId);
  }

  @Get(':id/breadcrumbs')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({ summary: 'Get breadcrumb trail for a page' })
  async getBreadcrumbs(
    @Param('id', ParseIntPipe) id: number,
    @Locale() languageId: number,
  ): Promise<Array<{ id: number; slug: string; title: string }>> {
    return this.pagesService.getBreadcrumbs(id, languageId);
  }

  @Get(':id/siblings')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({ summary: 'Get sibling pages (same parent, same level)' })
  async findSiblings(
    @Param('id', ParseIntPipe) id: number,
    @Locale() languageId: number,
  ): Promise<PageListItemDto[]> {
    const siblings = await this.pagesService.findPublishedSiblings(id, languageId);
    return siblings as unknown as PageListItemDto[];
  }

  @Get('template/:templateId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({ summary: 'Get pages by template ID' })
  async findByTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Locale() languageId: number,
  ): Promise<PageListItemDto[]> {
    const pages = await this.pagesService.findPublishedByTemplate(templateId, languageId);
    return pages as unknown as PageListItemDto[];
  }

  // ==================================================
  // UPDATE
  // ==================================================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.UPDATE_PAGES)
  @ApiOperation({
    summary: 'Update page aggregate',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageAggregateDto,
    @Req() req: Request,
  ): Promise<PageAggregateResponseDto> {
    const existing = await this.pagesService.findAggregateById(id);
    const aggregate = PageMapper.toAggregateForUpdate(dto, existing);

    const updated = await this.pagesService.updateAggregate(id, aggregate, undefined, getMeta(req));
    return PageMapper.toResponse(updated);
  }

  // ==================================================
  // DELETE SYSTEM
  // ==================================================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PagesPermissions.DELETE_PAGES)
  @ApiOperation({
    summary: 'Move page to trash (soft delete)',
  })
  async trash(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.pagesService.softDelete(id, getMeta(req));
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.DELETE_PAGES)
  @ApiOperation({
    summary: 'Restore page from trash',
  })
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.pagesService.restore(id, getMeta(req));
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PagesPermissions.DELETE_PAGES)
  @ApiOperation({
    summary: 'Hard delete page forever',
  })
  async hardDelete(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.pagesService.hardDelete(id, getMeta(req));
  }

  // ==================================================
  // REORDER + BULK
  // ==================================================

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.UPDATE_PAGES)
  async reorder(
    @Body() body: { updates: Array<{ id: number; sortOrder: number }> },
  ): Promise<void> {
    await this.pagesService.reorderPages(body.updates);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  @ApiOperation({
    summary: 'Bulk action on pages',
  })
  async bulkAction(
    @Body()
    body: {
      ids: number[];
      action: 'publish' | 'unpublish' | 'delete' | 'restore' | 'hardDelete';
    },
    @Req() req: AuthRequest,
  ): Promise<void> {
    const { permissions } = req.user;

    if (body.action === 'delete' || body.action === 'hardDelete' || body.action === 'restore') {
      if (!permissions.includes('*') && !permissions.includes(PagesPermissions.DELETE_PAGES)) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${PagesPermissions.DELETE_PAGES}`,
        );
      }
    } else {
      if (!permissions.includes('*') && !permissions.includes(PagesPermissions.PUBLISH_PAGES)) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${PagesPermissions.PUBLISH_PAGES}`,
        );
      }
    }

    await this.pagesService.bulkAction(body.ids, body.action, getMeta(req));
  }

  // ==================================================
  // SLUG CHECK
  // ==================================================

  @Get('check-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  async checkSlugUnique(
    @Param('slug') slug: string,
    @Query('languageId', ParseIntPipe) languageId: number,
    @Query('excludePageId') excludePageId?: string,
  ) {
    const excludeId = excludePageId ? parseInt(excludePageId, 10) : undefined;
    const isUnique = await this.pagesService.isSlugUnique(slug, languageId, excludeId);

    return { isUnique, slug };
  }

  // ==================================================
  // VERSIONING
  // ==================================================

  @Get(':id/versions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.VIEW_PAGES)
  async getVersions(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PagePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<PageVersion>> {
    return this.pagesService.getVersions(id, query);
  }

  @Post('versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PagesPermissions.UPDATE_PAGES)
  async restoreVersion(@Param('versionId', ParseIntPipe) versionId: number): Promise<void> {
    await this.pagesService.restoreVersion(versionId);
  }
}
