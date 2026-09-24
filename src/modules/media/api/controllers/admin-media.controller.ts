// ─────────────────────────────────────────────────────────────
// File: src/modules/media/api/controllers/admin-media.controller.ts
// ─────────────────────────────────────────────────────────────

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
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
  StreamableFile,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiConsumes,
} from '@nestjs/swagger';

import { MediaService } from '../../application/media.service';

import {
  UploadMediaDto,
  UpdateMediaDto,
  CreateFolderDto,
  MediaResponseDto,
  MediaStatsResponseDto,
  MediaPaginatedQueryDto,
} from '../../dto';
import { BulkMediaIdsDto } from '../../dto/folder.dto';

import {
  SingleFileUploadInterceptor,
  MultiFileUploadInterceptor,
} from '../interceptors/media-upload.interceptor';

import { ApiIdParam, ApiStandardResponses } from '@/common/decorators/api-decorators';
import { PaginatedResponseDto } from '@/common/pagination';
import { getMeta } from '@/common/helper/action-meta';

@ApiTags('Admin - Media')
@Controller('admin/media')
@ApiStandardResponses()
export class AdminMediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ==================================================
  // UPLOAD
  // ==================================================

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  // @RequirePermissions(MediaPermissions.UPLOAD_MEDIA)
  @UseInterceptors(SingleFileUploadInterceptor)
  @ApiOperation({ summary: 'Upload a single media file' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: MediaResponseDto })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @Req() req: Request,
  ): Promise<MediaResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.mediaService.upload(file, dto, getMeta(req));
  }

  @Post('upload/bulk')
  @HttpCode(HttpStatus.CREATED)
  // @RequirePermissions(MediaPermissions.UPLOAD_MEDIA)
  @UseInterceptors(MultiFileUploadInterceptor)
  @ApiOperation({ summary: 'Upload multiple media files (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: [MediaResponseDto] })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMediaDto,
    @Req() req: Request,
  ): Promise<MediaResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    return this.mediaService.uploadMultiple(files, dto, getMeta(req));
  }

  // ==================================================
  // FOLDERS
  // ==================================================

  @Get('folders')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.VIEW_MEDIA)
  @ApiOperation({ summary: 'List all folders (disk + DB, including empty)' })
  async listFolders(): Promise<
    { folder: string; count: number; totalSize: number; totalSizeFormatted: string }[]
  > {
    return this.mediaService.listFolders();
  }

  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  // @RequirePermissions(MediaPermissions.UPLOAD_MEDIA)
  @ApiOperation({ summary: 'Create a new folder on disk' })
  @ApiCreatedResponse({ schema: { example: { folder: 'pages' } } })
  async createFolder(
    @Body() dto: CreateFolderDto,
    @Req() req: Request,
  ): Promise<{ folder: string }> {
    return this.mediaService.createFolder(dto.name, getMeta(req));
  }

  // ==================================================
  // LIST + PAGINATION (Static Routes BEFORE :id)
  // ==================================================

  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.VIEW_MEDIA)
  @ApiOperation({ summary: 'Get media list with pagination' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: MediaPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<MediaResponseDto>> {
    return this.mediaService.findAllPaginated(query);
  }

  // ==================================================
  // STATS (Static Route BEFORE :id)
  // ==================================================

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.VIEW_MEDIA)
  @ApiOperation({ summary: 'Get media library stats for dashboard' })
  @ApiOkResponse({ type: MediaStatsResponseDto })
  async getStats(): Promise<MediaStatsResponseDto> {
    return this.mediaService.getStats();
  }

  // ==================================================
  // DOWNLOAD (Static Route BEFORE :id)
  // ==================================================

  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.VIEW_MEDIA)
  @ApiOperation({ summary: 'Download a media file by ID' })
  @ApiIdParam('id', 'Media ID')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename, mimeType } = await this.mediaService.download(id);

    // Decode stored name (may be URL-encoded, e.g. "Node.js%20Syllabus.pdf")
    const decoded = decodeURIComponent(filename);
    const encoded = encodeURIComponent(decoded);
    (res as any).set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${decoded}"; filename*=UTF-8''${encoded}`,
    });

    return stream;
  }

  // ==================================================
  // SINGLE MEDIA
  // ==================================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.VIEW_MEDIA)
  @ApiOperation({ summary: 'Get media by ID' })
  @ApiIdParam('id', 'Media ID')
  @ApiOkResponse({ type: MediaResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MediaResponseDto> {
    return this.mediaService.findById(id);
  }

  // ==================================================
  // UPDATE METADATA
  // ==================================================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.UPDATE_MEDIA)
  @ApiOperation({ summary: 'Update media metadata (folder, tags, alt, caption)' })
  @ApiIdParam('id', 'Media ID')
  @ApiOkResponse({ type: MediaResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMediaDto,
    @Req() req: Request,
  ): Promise<MediaResponseDto> {
    return this.mediaService.update(id, dto, getMeta(req));
  }

  // ==================================================
  // DELETE BY URL (site/ files only)
  // ==================================================

  @Delete('by-url')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Soft-delete a site-scoped media file by its URL' })
  @ApiNoContentResponse()
  async removeByUrl(@Body('url') url: string, @Req() req: Request): Promise<void> {
    if (!url) return;
    await this.mediaService.deleteByUrl(url, getMeta(req));
  }

  // ==================================================
  // SOFT DELETE
  // ==================================================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Soft-delete media (moves to trash, restorable)' })
  @ApiIdParam('id', 'Media ID')
  @ApiNoContentResponse()
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.mediaService.softDelete(id, getMeta(req));
  }

  // ==================================================
  // RESTORE
  // ==================================================

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Restore a soft-deleted media record from trash' })
  @ApiIdParam('id', 'Media ID')
  @ApiOkResponse({ type: MediaResponseDto })
  async restore(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<MediaResponseDto> {
    return this.mediaService.restore(id, getMeta(req));
  }

  // Loops the existing single-item restore (rather than a Prisma updateMany)
  // so each file gets the same per-item side effects (audit log, response
  // shape) as the row-level action above.
  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Restore multiple soft-deleted media records from trash' })
  async bulkRestore(@Body() dto: BulkMediaIdsDto, @Req() req: Request): Promise<void> {
    for (const id of dto.ids) {
      await this.mediaService.restore(id, getMeta(req));
    }
  }

  // ==================================================
  // HARD DELETE (permanent)
  // ==================================================

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Permanently delete media file from disk and DB (irreversible)' })
  @ApiIdParam('id', 'Media ID')
  @ApiNoContentResponse()
  async hardDelete(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.mediaService.hardDelete(id, getMeta(req));
  }

  @Post('bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(MediaPermissions.DELETE_MEDIA)
  @ApiOperation({ summary: 'Permanently delete multiple media files from disk and DB' })
  async bulkHardDelete(@Body() dto: BulkMediaIdsDto, @Req() req: Request): Promise<void> {
    for (const id of dto.ids) {
      await this.mediaService.hardDelete(id, getMeta(req));
    }
  }
}
