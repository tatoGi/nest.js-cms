// src/modules/posts/api/controllers/admin-posts.controller.ts

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
import { getMeta } from '@/common/helper/action-meta';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Locale } from '@/common/decorators/locale.decorator';

import { PostsService } from '../../application/post.service';
import { PostsPermissions } from '../../application/posts.permissions';

import {
  CreatePostAggregateDto,
  UpdatePostAggregateDto,
  PostAggregateResponseDto,
  PostQueryDto,
  PostListItemDto,
  PostPaginatedQueryDto,
} from '../../dto';

import { PostMapper } from '../mappers/post.mapper';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';
import { PaginatedResponseDto } from '@/common/pagination';
import { PagePaginatedQueryDto } from '@/modules/menu/dto/pagination.dto';
import { AuthRequest } from '@/modules/auth/interface/auth-request.interface';
import { Request } from 'express';

@ApiTags('Admin - Posts')
@Controller('admin/posts')
@UseInterceptors(CacheInterceptor('posts'))
export class AdminPostsController {
  constructor(private readonly postsService: PostsService) {}

  // ==================================================
  // CREATE POST
  // ==================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PostsPermissions.CREATE_POSTS)
  @ApiOperation({
    summary: 'Create post',
    description: 'Creates a new post with translations and content blocks',
  })
  @ApiCreatedResponse({ type: PostAggregateResponseDto })
  async create(
    @Body() dto: CreatePostAggregateDto,
    @Req() req: Request,
  ): Promise<PostAggregateResponseDto> {
    const aggregate = PostMapper.toAggregate(dto);
    const created = await this.postsService.createAggregate(aggregate, getMeta(req));
    return PostMapper.toResponse(created);
  }

  // ==================================================
  // LIST POSTS
  // ==================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get posts list',
    description: 'Returns list of posts with translation based on Accept-Language',
  })
  @ApiOkResponse({ type: [PostListItemDto] })
  async findAll(
    @Query() query: PostQueryDto,
    @Locale() languageId: number,
  ): Promise<PostListItemDto[]> {
    return this.postsService.findAllList(query, languageId);
  }

  // ==================================================
  // LIST POSTS PAGINATED
  // ==================================================
  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get posts paginated',
    description: 'Returns paginated list of posts',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: PostPaginatedQueryDto,
    @Locale() languageId: number,
  ): Promise<PaginatedResponseDto<PostListItemDto>> {
    return this.postsService.findAllListPaginated(query, languageId);
  }

  // ==================================================
  // LIST TRASH POSTS
  // ==================================================
  @Get('trash')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get trashed posts',
    description: 'Returns all soft deleted posts',
  })
  @ApiOkResponse({ type: [PostListItemDto] })
  async getTrash(@Locale() languageId: number): Promise<PostListItemDto[]> {
    return this.postsService.getDeletedPosts(languageId);
  }

  // ==================================================
  // GET POST BY ID
  // ==================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get post by ID',
    description: 'Returns full post aggregate with all translations + blocks',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiOkResponse({ type: PostAggregateResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<PostAggregateResponseDto> {
    const post = await this.postsService.findAggregateById(id);
    return PostMapper.toResponse(post);
  }

  // ==================================================
  // GET POST BY SLUG + LANGUAGE
  // ==================================================
  @Get('by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get post by slug',
    description: 'Returns full post aggregate by slug + language',
  })
  @ApiParam({ name: 'slug', description: 'Post slug' })
  @ApiOkResponse({ type: PostAggregateResponseDto })
  async findBySlug(
    @Param('slug') slug: string,
    @Locale() languageId: number,
  ): Promise<PostAggregateResponseDto> {
    const post = await this.postsService.findAggregateBySlug(slug, languageId);
    return PostMapper.toResponse(post);
  }

  // ==================================================
  // UPDATE POST
  // ==================================================
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.UPDATE_POSTS)
  @ApiOperation({
    summary: 'Update post',
    description: 'Updates post translations + blocks (creates versions)',
  })
  @ApiOkResponse({ type: PostAggregateResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostAggregateDto,
    @Req() req: Request,
  ): Promise<PostAggregateResponseDto> {
    const existing = await this.postsService.findAggregateById(id);
    const aggregate = PostMapper.toAggregateForUpdate(dto, existing);

    const updated = await this.postsService.updateAggregate(id, aggregate, getMeta(req));

    return PostMapper.toResponse(updated);
  }

  // ==================================================
  // SOFT DELETE → TRASH
  // ==================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PostsPermissions.DELETE_POSTS)
  @ApiOperation({
    summary: 'Move post to trash',
    description: 'Soft deletes a post (deletedAt is set)',
  })
  async trash(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.postsService.softDelete(id, getMeta(req));
  }

  // ==================================================
  // RESTORE FROM TRASH
  // ==================================================
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.DELETE_POSTS)
  @ApiOperation({
    summary: 'Restore post',
    description: 'Restores a trashed post (deletedAt → null)',
  })
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.postsService.restore(id, getMeta(req));
  }

  // ==================================================
  // HARD DELETE FOREVER
  // ==================================================
  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PostsPermissions.DELETE_POSTS)
  @ApiOperation({
    summary: 'Delete post permanently',
    description: 'Permanently removes post + translations + blocks',
  })
  async hardDelete(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    await this.postsService.hardDelete(id, getMeta(req));
  }

  // ==================================================
  // VERSION HISTORY
  // ==================================================
  @Get(':id/versions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Get post versions',
    description: 'Returns version history for a post',
  })
  async getVersions(@Param('id', ParseIntPipe) id: number, @Query() query: PagePaginatedQueryDto) {
    return this.postsService.getVersions(id, query);
  }

  // ==================================================
  // RESTORE VERSION
  // ==================================================
  @Patch('versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.UPDATE_POSTS)
  @ApiOperation({
    summary: 'Restore post version',
    description: 'Restores a post translation snapshot from version history',
  })
  @ApiParam({
    name: 'versionId',
    description: 'Version ID to restore',
    example: 5,
  })
  async restoreVersion(@Param('versionId', ParseIntPipe) versionId: number): Promise<void> {
    await this.postsService.restoreVersion(versionId);
  }

  // ==================================================
  // BULK ACTIONS
  // ==================================================
  @Post('bulk-action')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Bulk action',
    description: 'Publish / unpublish / delete / restore / permanently delete multiple posts',
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
      if (!permissions.includes('*') && !permissions.includes(PostsPermissions.DELETE_POSTS)) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${PostsPermissions.DELETE_POSTS}`,
        );
      }
    } else {
      if (!permissions.includes('*') && !permissions.includes(PostsPermissions.PUBLISH_POSTS)) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${PostsPermissions.PUBLISH_POSTS}`,
        );
      }
    }

    await this.postsService.bulkAction(body.ids, body.action, getMeta(req));
  }

  // ==================================================
  // SLUG UNIQUE CHECK
  // ==================================================
  @Get('check-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostsPermissions.VIEW_POSTS)
  @ApiOperation({
    summary: 'Check slug uniqueness',
  })
  async checkSlugUnique(
    @Param('slug') slug: string,
    @Query('languageId', ParseIntPipe) languageId: number,
    @Query('excludePostId') excludePostId?: string,
  ) {
    const excludeId = excludePostId ? parseInt(excludePostId, 10) : undefined;

    const isUnique = await this.postsService.isSlugUnique(slug, languageId, excludeId);

    return { isUnique, slug };
  }
}
