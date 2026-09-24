// src/modules/page-templates/api/controllers/public-page-templates.controller.ts

import { Controller, Get, Param } from '@nestjs/common';
import { PageTemplatesService } from '../../application/page-templates.service';

@Controller('page-templates')
export class PublicPageTemplatesController {
  constructor(private readonly service: PageTemplatesService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}
