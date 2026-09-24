// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/api/controllers/admin-settings.controller.ts
// ─────────────────────────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ApiStandardResponses, ApiIdParam } from '@/common/decorators/api-decorators';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { SettingsService } from '../../application/settings.service';
import { SettingsPermissions } from '../../application/settings.permissions';
import {
  CreateSettingDto,
  UpdateSettingDto,
  UpdateSettingsettingGlobalContentDto,
  UpdateSettingLocalizedContentDto,
  SettingResponseDto,
  SettingPaginatedQueryDto,
} from '../../dto';
import { PaginatedResponseDto } from '@/common/pagination';

@ApiTags('Admin - Settings')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ==================================================
  // LIST — Grouped by group
  // ==================================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all settings',
    description: 'Returns all settings for the admin panel.',
  })
  @ApiOkResponse({ type: SettingResponseDto, isArray: true })
  async findAll(): Promise<SettingResponseDto[]> {
    return this.settingsService.findAll();
  }

  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get settings list with pagination' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: SettingPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<SettingResponseDto>> {
    return this.settingsService.findAllPaginated(query);
  }

  // ==================================================
  // GET BY ID
  // ==================================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SettingsPermissions.VIEW_SETTINGS)
  @ApiOperation({ summary: 'Get setting by ID' })
  @ApiIdParam('id', 'Setting ID')
  @ApiOkResponse({ type: SettingResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<SettingResponseDto> {
    return this.settingsService.findById(id);
  }

  // ==================================================
  // CREATE
  // ==================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(SettingsPermissions.CREATE_SETTING)
  @ApiOperation({
    summary: 'Create a new setting',
    description:
      'Creates a new setting definition. Key must be unique snake_case. ' +
      'Set isTranslatable=true for per-language values, false for global values.',
  })
  @ApiCreatedResponse({ type: SettingResponseDto })
  async create(@Body() dto: CreateSettingDto, @Req() req: Request): Promise<SettingResponseDto> {
    return this.settingsService.create(dto, getMeta(req));
  }

  // ==================================================
  // UPDATE SETTING META
  // ==================================================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SettingsPermissions.UPDATE_SETTING)
  @ApiOperation({
    summary: 'Update setting metadata',
    description:
      'Updates group, label, description, isPublic, isActive. ' +
      'Cannot change key or isTranslatable after creation.',
  })
  @ApiIdParam('id', 'Setting ID')
  @ApiOkResponse({ type: SettingResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSettingDto,
    @Req() req: Request,
  ): Promise<SettingResponseDto> {
    return this.settingsService.update(id, dto, getMeta(req));
  }

  // ==================================================
  // DELETE
  // ==================================================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(SettingsPermissions.DELETE_SETTING)
  @ApiOperation({ summary: 'Delete a setting' })
  @ApiIdParam('id', 'Setting ID')
  @ApiNoContentResponse({ description: 'Setting deleted' })
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.settingsService.delete(id, getMeta(req));
  }

  // ==================================================
  // UPDATE VALUE (non-translatable)
  // ==================================================

  @Patch(':id/global-content')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SettingsPermissions.UPDATE_SETTING)
  @ApiOperation({
    summary: 'Update global value (non-translatable setting)',
    description:
      'Sets the JSON value for a non-translatable setting. ' +
      'Will throw 400 if setting.isTranslatable = true.',
  })
  @ApiIdParam('id', 'Setting ID')
  @ApiOkResponse({ type: SettingResponseDto })
  async updatesettingGlobalContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSettingsettingGlobalContentDto,
    @Req() req: Request,
  ): Promise<SettingResponseDto> {
    return this.settingsService.updatesettingGlobalContent(id, dto, getMeta(req));
  }

  // ==================================================
  // UPDATE TRANSLATION (translatable)
  // ==================================================

  @Patch(':id/localized-content/:languageId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SettingsPermissions.UPDATE_SETTING)
  @ApiOperation({
    summary: 'Update translation (translatable setting)',
    description:
      'Sets the JSON value for a specific language. ' +
      'Will throw 400 if setting.isTranslatable = false.',
  })
  @ApiIdParam('id', 'Setting ID')
  @ApiIdParam('languageId', 'Language ID')
  @ApiOkResponse({ type: SettingResponseDto })
  async updateLocalizedContent(
    @Param('id', ParseIntPipe) id: number,
    @Param('languageId', ParseIntPipe) languageId: number,
    @Body() dto: UpdateSettingLocalizedContentDto,
    @Req() req: Request,
  ): Promise<SettingResponseDto> {
    return this.settingsService.updateLocalizedContent(id, languageId, dto, getMeta(req));
  }
}
