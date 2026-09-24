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
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PostCategoryService } from '../../application/post-category.service';
import { PostCategoryMapper } from '../mappers/post-category.mapper';
import {
  CreatePostCategoryAggregateDto,
  UpdatePostCategoryAggregateDto,
  PostCategoryPaginatedQueryDto,
  PostCategoryListItemDto,
} from '../../dto';
import { PostCategoryPermissions } from '../../application/post-categories.permissions';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';
import { ApiStandardResponses } from '@/common/decorators/api-decorators';
import { Locale } from '@/common/decorators/locale.decorator';
import { RequirePermissions } from '@/common/guards/permissions.guard';

@ApiTags('Admin - Post Categories')
@Controller('admin/post-categories')
@UseInterceptors(CacheInterceptor('post-categories'))
@ApiStandardResponses()
export class AdminPostCategoriesController {
  constructor(private readonly postCategoryService: PostCategoryService) {}

  @Get('paginated')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostCategoryPermissions.VIEW_POST_CATEGORY)
  @ApiOperation({
    summary: 'Get post categories list with pagination',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAllPaginated(
    @Query() query: PostCategoryPaginatedQueryDto,
    @Locale() languageId: number,
  ): Promise<PaginatedResponseDto<PostCategoryListItemDto>> {
    return this.postCategoryService.findAllListPaginated(query, languageId);
  }

  @Get('tree')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostCategoryPermissions.VIEW_POST_CATEGORY)
  @ApiOperation({ summary: 'Get post categories as tree' })
  async findTree(@Query('languageCode') languageCode?: string) {
    const tree = await this.postCategoryService.findAllTree(languageCode);
    return tree.map((item) => PostCategoryMapper.toAggregateResponse(item));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostCategoryPermissions.VIEW_POST_CATEGORY)
  @ApiOperation({ summary: 'Get post category by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const category = await this.postCategoryService.findById(id);
    return PostCategoryMapper.toAggregateResponse(category);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PostCategoryPermissions.CREATE_POST_CATEGORY)
  @ApiOperation({ summary: 'Create post category' })
  async create(@Body() dto: CreatePostCategoryAggregateDto) {
    console.log('Creating post category with data:', dto);
    const category = await this.postCategoryService.create(dto);
    return PostCategoryMapper.toAggregateResponse(category);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostCategoryPermissions.UPDATE_POST_CATEGORY)
  @ApiOperation({ summary: 'Update post category' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePostCategoryAggregateDto) {
    const category = await this.postCategoryService.update(id, dto);
    return PostCategoryMapper.toAggregateResponse(category);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PostCategoryPermissions.DELETE_POST_CATEGORY)
  @ApiOperation({ summary: 'Delete post category' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    console.log(`Deleting post category with ID: ${id}`);
    return await this.postCategoryService.delete(id);
  }

  @Get('by-slug/:slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PostCategoryPermissions.VIEW_POST_CATEGORY)
  @ApiOperation({ summary: 'Get post category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    const category = await this.postCategoryService.findBySlug(slug);
    return PostCategoryMapper.toAggregateResponse(category);
  }
}
