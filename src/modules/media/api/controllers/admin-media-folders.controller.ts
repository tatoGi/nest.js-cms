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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { MediaFoldersService } from '../../application/media-folders.service';
import {
  CreateFolderDto,
  RenameFolderDto,
  MoveFolderDto,
  FolderResponseDto,
  FolderBreadcrumbDto,
} from '../../dto/folder.dto';

@ApiTags('Admin / Media Folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/media-folders')
export class AdminMediaFoldersController {
  constructor(private readonly foldersService: MediaFoldersService) {}

  // ─── List ─────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get flat list of all folders (build tree client-side)' })
  @ApiOkResponse({ type: [FolderResponseDto] })
  findAll(@Query('scope') scope?: string): Promise<FolderResponseDto[]> {
    return this.foldersService.findAll(scope);
  }

  // ─── Single ───────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single folder by ID' })
  @ApiOkResponse({ type: FolderResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<FolderResponseDto> {
    return this.foldersService.findOne(id);
  }

  // ─── Breadcrumbs ──────────────────────────────────────────────────────────────

  @Get(':id/breadcrumbs')
  @ApiOperation({ summary: 'Get breadcrumb path from root to folder' })
  @ApiOkResponse({ type: [FolderBreadcrumbDto] })
  getBreadcrumbs(@Param('id', ParseIntPipe) id: number): Promise<FolderBreadcrumbDto[]> {
    return this.foldersService.getBreadcrumbs(id);
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiCreatedResponse({ type: FolderResponseDto })
  create(@Body() dto: CreateFolderDto): Promise<FolderResponseDto> {
    return this.foldersService.create(dto);
  }

  // ─── Rename ───────────────────────────────────────────────────────────────────

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename a folder' })
  @ApiOkResponse({ type: FolderResponseDto })
  rename(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenameFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.rename(id, dto);
  }

  // ─── Move ─────────────────────────────────────────────────────────────────────

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move folder to a different parent (null = root)' })
  @ApiOkResponse({ type: FolderResponseDto })
  move(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.move(id, dto);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a folder (must be empty)' })
  @ApiNoContentResponse()
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.foldersService.delete(id);
  }
}
