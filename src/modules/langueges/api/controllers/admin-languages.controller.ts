// src/modules/languages/api/controllers/admin-languages.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';

// Service & Permissions
import { LanguagesService } from '../../application/languages.service';
import { LanguagesPermissions } from '../../application/languages.permissions';

// DTOs
import {
  CreateLanguageDto,
  UpdateLanguageDto,
  LanguageQueryDto,
  LanguageResponseDto,
} from '../../dto';

// Guards & Interceptors
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';

// Common Decorators
import { ApiIdParam, ApiStandardResponses } from '@/common/decorators/api-decorators';

@ApiTags('Admin - Languages')
@Controller('admin/languages')
@UseInterceptors(CacheInterceptor('languages'))
@ApiStandardResponses()
export class AdminLanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /**
   * Create a new language
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(LanguagesPermissions.CREATE_LANGUAGES)
  @ApiOperation({
    summary: 'Create a new language',
    description: 'Creates a new language for the CMS',
  })
  @ApiCreatedResponse({
    description: 'Language created successfully',
    type: LanguageResponseDto,
  })
  async create(@Body() dto: CreateLanguageDto): Promise<LanguageResponseDto> {
    return this.languagesService.create(dto);
  }

  /**
   * Get all languages
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(LanguagesPermissions.VIEW_LANGUAGES)
  @ApiOperation({
    summary: 'Get all languages',
    description: 'Retrieves all languages with optional filters',
  })
  @ApiOkResponse({
    description: 'Languages retrieved successfully',
    type: [LanguageResponseDto],
  })
  async findAll(@Query() query: LanguageQueryDto): Promise<LanguageResponseDto[]> {
    return this.languagesService.findAll(query);
  }

  /**
   * Get a language by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(LanguagesPermissions.VIEW_LANGUAGES)
  @ApiOperation({
    summary: 'Get a language by ID',
  })
  @ApiIdParam('id', 'Language ID')
  @ApiOkResponse({
    description: 'Language retrieved successfully',
    type: LanguageResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<LanguageResponseDto> {
    return this.languagesService.findOne(id);
  }

  /**
   * Get language by code
   */
  @Get('code/:code')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(LanguagesPermissions.VIEW_LANGUAGES)
  @ApiOperation({
    summary: 'Get a language by code',
  })
  @ApiOkResponse({
    description: 'Language retrieved successfully',
    type: LanguageResponseDto,
  })
  async findByCode(@Param('code') code: string): Promise<LanguageResponseDto> {
    return this.languagesService.findByCode(code);
  }

  /**
   * Update a language
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(LanguagesPermissions.UPDATE_LANGUAGES)
  @ApiOperation({
    summary: 'Update a language',
  })
  @ApiIdParam('id', 'Language ID')
  @ApiOkResponse({
    description: 'Language updated successfully',
    type: LanguageResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLanguageDto,
  ): Promise<LanguageResponseDto> {
    console.log('AdminLanguagesController.update: called with id=', id, ' dto=', dto);
    return this.languagesService.update(id, dto);
  }

  /**
   * Delete a language
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(LanguagesPermissions.DELETE_LANGUAGES)
  @ApiOperation({
    summary: 'Delete a language',
  })
  @ApiIdParam('id', 'Language ID')
  @ApiNoContentResponse({
    description: 'Language deleted successfully',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.languagesService.remove(id);
  }

  /**
   * Toggle language enabled status
   */
  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(LanguagesPermissions.TOGGLE_LANGUAGES)
  @ApiOperation({
    summary: 'Toggle language status',
  })
  @ApiIdParam('id', 'Language ID')
  @ApiOkResponse({
    description: 'Language status toggled successfully',
    type: LanguageResponseDto,
  })
  async toggleEnabled(@Param('id', ParseIntPipe) id: number): Promise<LanguageResponseDto> {
    return this.languagesService.toggleActive(id);
  }
}
