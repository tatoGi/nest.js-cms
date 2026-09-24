// ─────────────────────────────────────────────────────────────
// File: src/modules/site/api/controllers/public-site.controller.ts
// ─────────────────────────────────────────────────────────────

import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { Public } from '@/common/decorators/public.decorator';
import { SiteService } from '../../application/site.service';
import {
  SiteInitResponseDto,
  SiteLanguageDto,
  SiteLayoutResponseDto,
  SitePageBundleResponseDto,
  SitePostBundleResponseDto,
  SitePagePostBundleResponseDto,
  SitePostSummaryDto,
  SiteRedirectDto,
} from '../../dto';

@ApiTags('Public Site')
@Public()
@Controller('site')
export class PublicSiteController {
  constructor(private readonly siteService: SiteService) {}

  // ==================================================
  // INIT — Languages Only (Lightweight)
  // ==================================================

  @Get('init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get site initialization data',
    description: 'Returns active languages and default language.',
  })
  @ApiOkResponse({ type: SiteInitResponseDto })
  async getInit(): Promise<SiteInitResponseDto> {
    return this.siteService.getInit();
  }

  // ==================================================
  // LANGUAGES
  // ==================================================

  @Get('languages')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [SiteLanguageDto] })
  async getLanguages(): Promise<SiteLanguageDto[]> {
    return this.siteService.getLanguages();
  }

  // ==================================================
  // LAYOUT — Per Language
  // ==================================================

  @Get(':lang/layout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get site layout (menus + settings)',
  })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiOkResponse({ type: SiteLayoutResponseDto })
  async getLayout(@Param('lang') lang: string): Promise<SiteLayoutResponseDto> {
    return this.siteService.getLayoutByCode(lang);
  }

  // ==================================================
  // HOME BUNDLE
  // ==================================================

  @Get(':lang/home')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get home page bundle',
    description: 'Returns the page marked as isHome=true for the given language',
  })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiOkResponse({ type: SitePageBundleResponseDto })
  @ApiNotFoundResponse({ description: 'Home page not found' })
  async getHomeBundle(@Param('lang') lang: string): Promise<SitePageBundleResponseDto> {
    return this.siteService.getHomeBundleByCode(lang);
  }

  // ==================================================
  // PAGE BUNDLE
  // ==================================================

  @Get(':lang/page/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full page bundle',
  })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiParam({ name: 'slug', example: 'home' })
  @ApiOkResponse({ type: SitePageBundleResponseDto })
  @ApiNotFoundResponse({ description: 'Page not found' })
  async getPageBundle(
    @Param('lang') lang: string,
    @Param('slug') slug: string,
  ): Promise<SitePageBundleResponseDto | SiteRedirectDto> {
    return this.siteService.getPageBundleByCode(lang, slug);
  }

  // ==================================================
  // POST BUNDLE
  // ==================================================

  @Get(':lang/post/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full post bundle',
  })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiParam({ name: 'slug', example: 'my-article' })
  @ApiOkResponse({ type: SitePostBundleResponseDto })
  @ApiNotFoundResponse({ description: 'Post not found' })
  async getPostBundle(
    @Param('lang') lang: string,
    @Param('slug') slug: string,
  ): Promise<SitePostBundleResponseDto | SiteRedirectDto> {
    return this.siteService.getPostBundleByCode(lang, slug);
  }

  // ==================================================
  // PAGE + POST BUNDLE (combined)
  // ==================================================

  @Get(':lang/:pageSlug/post/:postSlug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get page template + post bundle in one call' })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiParam({ name: 'pageSlug', example: 'news' })
  @ApiParam({ name: 'postSlug', example: 'my-article' })
  @ApiOkResponse({ type: SitePagePostBundleResponseDto })
  @ApiNotFoundResponse({ description: 'Page or Post not found' })
  async getPagePostBundle(
    @Param('lang') lang: string,
    @Param('pageSlug') pageSlug: string,
    @Param('postSlug') postSlug: string,
  ): Promise<SitePagePostBundleResponseDto | SiteRedirectDto> {
    return this.siteService.getPagePostBundleByCode(lang, pageSlug, postSlug);
  }

  // ==================================================
  // PAGINATED POSTS BY TYPE
  // ==================================================

  @Get(':lang/posts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated posts by type' })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiQuery({
    name: 'type',
    example: 'news',
    enum: ['news', 'success', 'course'],
  })
  @ApiQuery({ name: 'page', example: 2 })
  @ApiQuery({ name: 'limit', example: 12 })
  @ApiQuery({ name: 'category', required: false, example: 'export' })
  @ApiOkResponse({ type: [SitePostSummaryDto] })
  async getPaginatedPosts(
    @Param('lang') lang: string,
    @Query('type') type: string,
    @Query('page') page = '2',
    @Query('limit') limit = '12',
    @Query('category') category?: string,
  ): Promise<SitePostSummaryDto[]> {
    return this.siteService.getPaginatedPostsByType(
      lang,
      type,
      parseInt(page, 10),
      parseInt(limit, 10),
      category,
    );
  }

  // ==================================================
  // SEARCH
  // ==================================================

  @Get(':lang/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search posts by query' })
  @ApiParam({ name: 'lang', example: 'en' })
  @ApiQuery({ name: 'q', example: 'export' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: [SitePostSummaryDto] })
  async search(
    @Param('lang') lang: string,
    @Query('q') query: string,
    @Query('limit') limit = '10',
  ): Promise<SitePostSummaryDto[]> {
    return this.siteService.search(lang, query, parseInt(limit, 10));
  }

  @Get('switch/:lang/:type/:slug')
  async switchLanguage(
    @Param('lang') lang: string,
    @Param('type') type: 'page' | 'post',
    @Param('slug') slug: string,
  ) {
    return this.siteService.getTranslatedSlug(lang, type, slug);
  }
}
