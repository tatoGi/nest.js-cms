// src/modules/page-templates/api/controllers/admin-page-templates.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  Req,
} from '@nestjs/common';
import { PageTemplatesService } from '../../application/page-templates.service';
import {
  CreatePageTemplateDto,
  UpdatePageTemplateDto,
  PageTemplateQueryDto,
  PageTemplatePaginatedQueryDto,
} from '../../dto';
import { PageTemplatesPermissions } from '../../application/page-templates.permissions';
import { RequirePermissions } from '@/common/guards/permissions.guard';

@Controller('admin/page-templates')
export class AdminPageTemplatesController {
  constructor(private readonly service: PageTemplatesService) {}

  @Post()
  @RequirePermissions(PageTemplatesPermissions.CREATE_PAGE_TEMPLATES)
  async create(@Body() dto: CreatePageTemplateDto) {
    return this.service.create(dto);
    // return this.service.create(dto, req.user.id);
  }

  @Get()
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findAll(@Query() query: PageTemplateQueryDto) {
    return this.service.findAll(query);
  }

  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findAllPaginated(@Query() query: PageTemplatePaginatedQueryDto) {
    return this.service.findAllPaginated(query);
  }

  @Get('recent')
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findRecentlyUpdated(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.service.findRecentlyUpdated(parsedLimit);
  }

  @Get('my-templates')
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findMyTemplates(@Req() req: any) {
    return this.service.findByCreator(req.user.id);
  }

  @Get(':id')
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Get('slug/:slug')
  @RequirePermissions(PageTemplatesPermissions.VIEW_PAGE_TEMPLATES)
  async findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Put(':id')
  @RequirePermissions(PageTemplatesPermissions.UPDATE_PAGE_TEMPLATES)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageTemplateDto) {
    return this.service.update(id, dto);
    // return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions(PageTemplatesPermissions.DELETE_PAGE_TEMPLATES)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
