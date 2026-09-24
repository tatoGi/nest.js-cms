// ─────────────────────────────────────────────────────────────
// File: src/modules/site/application/site.service.ts
// ─────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import {
  LanguageNotFoundException,
  PageNotFoundException,
  PostNotFoundException,
  AppException,
} from '@/common/exceptions';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

import type {
  Language,
  Setting,
  SettingLocalizedContent,
  SettingGlobalContent,
  MenuItem,
  MenuItemTranslation,
  Page,
  PageTranslation,
  PageContentBlock,
  Post,
  PostTranslation,
  PostContentBlock,
  PostCategoryPost,
  PostCategory,
  PostCategoryTranslation,
} from '@prisma/client';

import {
  SiteInitResponseDto,
  SiteLanguageDto,
  SiteLayoutResponseDto,
  SiteMediaDto,
  SiteMenuDto,
  SiteMenuItemDto,
  SitePageBundleResponseDto,
  SitePageDto,
  SitePostSummaryDto,
  SitePostsGroupedDto,
  SiteCategoryDto,
  SitePostBundleResponseDto,
  SitePostDetailDto,
  SitePagePostBundleResponseDto,
  SiteRedirectDto,
} from '../dto';

// ─────────────────────────────────────────────────────────────
// Block schema field type (mirrors CmsField shape)
// ─────────────────────────────────────────────────────────────
interface SchemaField {
  key: string;
  type: string;
  fields?: SchemaField[];
}

// ─────────────────────────────────────────────────────────────
// Prisma Include Types
// ─────────────────────────────────────────────────────────────

type SettingWithRelations = Setting & {
  settingLocalizedContent: SettingLocalizedContent[];
  settingGlobalContent: SettingGlobalContent | null;
};

type MenuItemWithTranslations = MenuItem & {
  translations: MenuItemTranslation[];
};

type PostCategoryWithTranslations = PostCategory & {
  translations: PostCategoryTranslation[];
};

type CategoryPostWithCategory = PostCategoryPost & {
  category: PostCategoryWithTranslations;
};

type PostTranslationWithBlocks = PostTranslation & {
  blocks: PostContentBlock[];
};

type PostWithRelations = Post & {
  translations: PostTranslationWithBlocks[];
  categories: CategoryPostWithCategory[];
};

type PageTranslationWithRelations = PageTranslation & {
  blocks: PageContentBlock[];
  page: Page & {
    translations: (PageTranslation & {
      language: Language;
    })[];
    template: { id: number; slug: string };
    posts: PostWithRelations[];
  };
};

type PostTranslationWithRelations = PostTranslation & {
  blocks: PostContentBlock[];
  post: Post & {
    categories: CategoryPostWithCategory[];
    translations: (PostTranslation & { language: Language })[];
  };
};

const POST_TYPES = ['news', 'success', 'course'] as const;
type SupportedPostType = (typeof POST_TYPES)[number];

// ─────────────────────────────────────────────────────────────
// Section template map — PostType → page template slug
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class SiteService {
  private layoutCache = new Map<number, CacheEntry<SiteLayoutResponseDto>>();
  private readonly LAYOUT_CACHE_TTL_MS = 60_000;

  private blockSchemaCache = new Map<string, SchemaField[]>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // MEDIA RESOLUTION
  // ============================================================

  /**
   * Loads block type schemas (cached) and all referenced media in one batch.
   * Returns schemaMap (blockType key → fields) and mediaMap (mediaId → SiteMediaDto).
   */
  private async buildMediaContext(
    blocks: Array<{ type: string; data: any }>,
    imageIds: (number | null | undefined)[],
  ): Promise<{ schemaMap: Map<string, SchemaField[]>; mediaMap: Map<number, SiteMediaDto> }> {
    const keys = [...new Set(blocks.map((b) => b.type))];

    // Load missing schemas into cache
    const missing = keys.filter((k) => !this.blockSchemaCache.has(k));
    if (missing.length > 0) {
      const rows = await this.prisma.blockTypeDefinition.findMany({
        where: { key: { in: missing } },
        select: { key: true, schema: true },
      });
      for (const row of rows) {
        this.blockSchemaCache.set(row.key, (row.schema as any)?.fields ?? []);
      }
    }

    const schemaMap = new Map<string, SchemaField[]>(
      keys.map((k) => [k, this.blockSchemaCache.get(k) ?? []]),
    );

    // Collect every media ID referenced across blocks + top-level image fields
    const allIds = new Set<number>();
    for (const id of imageIds) if (id != null) allIds.add(id);
    for (const block of blocks) {
      for (const id of this.collectMediaIds((block.data as Record<string, any>) ?? {})) {
        allIds.add(id);
      }
    }

    if (allIds.size === 0) return { schemaMap, mediaMap: new Map() };

    const records = await this.prisma.media.findMany({
      where: { id: { in: [...allIds] } },
      select: {
        id: true,
        url: true,
        mimeType: true,
        originalName: true,
        size: true,
        width: true,
        height: true,
        alt: true,
        caption: true,
      },
    });

    const mediaMap = new Map<number, SiteMediaDto>(records.map((m) => [m.id, m as SiteMediaDto]));

    return { schemaMap, mediaMap };
  }

  /** Recursively collect all mediaId values from any nested object/array. */
  private collectMediaIds(obj: any): number[] {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj)) return obj.flatMap((item) => this.collectMediaIds(item));

    const ids: number[] = [];
    if (typeof obj.mediaId === 'number') ids.push(obj.mediaId);
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') ids.push(...this.collectMediaIds(value));
    }
    return ids;
  }

  private resolveMediaUrl(url: string): string {
    if (!url || url.startsWith('http')) return url;
    const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
    return `${appUrl}${url}`;
  }

  private resolveMediaDto(media: SiteMediaDto | null | undefined): SiteMediaDto | null {
    if (!media) return null;
    return { ...media, url: this.resolveMediaUrl(media.url) };
  }

  /** Recursively inject media data into any object containing a `mediaId` reference. */
  private injectMediaData(obj: any, map: Map<number, SiteMediaDto>): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.injectMediaData(item, map));

    if (typeof obj.mediaId === 'number' && map.has(obj.mediaId)) {
      const media = map.get(obj.mediaId)!;
      const base = {
        ...obj,
        url: this.resolveMediaUrl(media.url),
        originalName: media.originalName,
        size: media.size,
        mimeType: media.mimeType,
      };

      if (media.mimeType?.startsWith('image/')) {
        return {
          ...base,
          width: media.width,
          height: media.height,
          alt: media.alt ?? '',
          caption: media.caption ?? '',
        };
      }

      return base;
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.injectMediaData(value, map);
    }
    return result;
  }

  // ============================================================
  // INIT (Languages only — lightweight)
  // ============================================================

  async getInit(): Promise<SiteInitResponseDto> {
    const [languages, homeTranslations] = await Promise.all([
      this.prisma.language.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.pageTranslation.findMany({
        where: { page: { isHome: true, published: true, deletedAt: null } },
        select: { slug: true, language: { select: { code: true } } },
      }),
    ]);

    const defaultLang = languages.find((l) => l.isDefault) ?? null;

    const homeSlugs: Record<string, string> = {};
    for (const t of homeTranslations) {
      homeSlugs[(t as any).language.code] = t.slug;
    }

    return {
      languages: languages.map(this.mapLanguage),
      defaultLanguage: defaultLang ? this.mapLanguage(defaultLang) : null,
      homeSlugs,
    };
  }

  // ============================================================
  // LANGUAGES
  // ============================================================

  async getLanguages(): Promise<SiteLanguageDto[]> {
    const languages = await this.prisma.language.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return languages.map(this.mapLanguage);
  }

  async getDefaultLanguage(): Promise<SiteLanguageDto | null> {
    const language = await this.prisma.language.findFirst({
      where: { isActive: true, isDefault: true },
    });
    return language ? this.mapLanguage(language) : null;
  }

  // ============================================================
  // LANGUAGE RESOLUTION
  // ============================================================

  /**
   * Resolves language with default fallback.
   * Used for layout/non-content endpoints where fallback is acceptable.
   */
  private async resolveLanguageByCode(code?: string): Promise<Language> {
    if (code) {
      const found = await this.prisma.language.findFirst({
        where: { code, isActive: true },
      });
      if (found) return found;
    }

    const fallback = await this.prisma.language.findFirst({
      where: { isActive: true, isDefault: true },
    });

    if (!fallback) {
      throw new LanguageNotFoundException('default');
    }

    return fallback;
  }

  /**
   * Strict language resolution — no fallback.
   * Used for content endpoints to prevent silent wrong-language serving.
   */
  private async strictResolveLanguage(code: string): Promise<Language> {
    const lang = await this.prisma.language.findFirst({
      where: { code, isActive: true },
    });

    if (!lang) {
      throw new LanguageNotFoundException(code);
    }

    return lang;
  }

  // Public helpers for controllers that use :lang (ka/en/...)
  async getLayoutByCode(code?: string): Promise<SiteLayoutResponseDto> {
    const lang = await this.resolveLanguageByCode(code);
    return this.getLayout(lang.id);
  }

  // ============================================================
  // PAGE BUNDLE — SEO-safe, no silent fallback
  // ============================================================

  async getHomeBundleByCode(code: string): Promise<SitePageBundleResponseDto> {
    const lang = await this.resolveLanguageByCode(code);

    const pt = await this.findHomePageTranslation(lang.id);

    if (!pt) {
      throw new AppException(
        ErrorCodes.PAGE_NOT_FOUND,
        'Home page not found or not published',
        HttpStatus.NOT_FOUND,
      );
    }

    const allBlocks = [
      ...pt.blocks.map((b) => ({ type: b.type, data: b.data })),
      ...pt.page.posts.flatMap((p) =>
        p.translations.flatMap((t) => t.blocks.map((b) => ({ type: b.type, data: b.data }))),
      ),
    ];
    const imageIds = [
      (pt.page as any).featureImageId,
      ...pt.page.posts.map((p) => (p as any).coverImageId),
    ];
    const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);

    return {
      page: this.mapPage(pt, schemaMap, mediaMap),
      posts: await this.buildGroupedPosts(pt.page.posts, lang.id, lang.code, schemaMap, mediaMap),
    };
  }

  async getPageBundleByCode(
    code: string,
    slug: string,
  ): Promise<SitePageBundleResponseDto | SiteRedirectDto> {
    const lang = await this.strictResolveLanguage(code);

    // 1. Exact match: slug exists in requested language
    const exact = await this.findPageTranslation(slug, lang.id);
    if (exact) {
      const allBlocks = [
        ...exact.blocks.map((b) => ({ type: b.type, data: b.data })),
        ...exact.page.posts.flatMap((p) =>
          p.translations.flatMap((t) => t.blocks.map((b) => ({ type: b.type, data: b.data }))),
        ),
      ];
      const imageIds = [
        (exact.page as any).featureImageId,
        ...exact.page.posts.map((p) => (p as any).coverImageId),
      ];
      const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);
      return {
        page: this.mapPage(exact, schemaMap, mediaMap),
        posts: await this.buildGroupedPosts(
          exact.page.posts,
          lang.id,
          lang.code,
          schemaMap,
          mediaMap,
        ),
      };
    }

    // 2. Slug exists but belongs to a different language
    const anyLangMatch = await this.prisma.pageTranslation.findFirst({
      where: { slug, page: { published: true, deletedAt: null } },
      include: {
        page: {
          include: {
            translations: { where: { languageId: lang.id } },
          },
        },
      },
    });

    if (!anyLangMatch) {
      throw new PageNotFoundException(slug);
    }

    // Slug belongs to a different language — find correct slug in requested language
    const correctTranslation = anyLangMatch.page.translations[0];
    if (!correctTranslation) {
      throw new AppException(
        ErrorCodes.PAGE_NOT_FOUND,
        `Page "${slug}" is not available in language "${code}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    return { redirectTo: `/${code}/${correctTranslation.slug}` };
  }

  // ============================================================
  // POST BUNDLE — SEO-safe, no silent fallback
  // ============================================================

  async getPostBundleByCode(
    code: string,
    slug: string,
  ): Promise<SitePostBundleResponseDto | SiteRedirectDto> {
    const lang = await this.strictResolveLanguage(code);

    // 1. Exact match
    const exact = await this.findPostTranslation(slug, lang.id);
    if (exact) {
      const sectionSlugsByType = await this.getSectionSlugsByType();
      const categoryIds = exact.post.categories.map((cp) => cp.categoryId);
      const relatedRaw = await this.findRelatedPostsByCategories(
        exact.post.id,
        categoryIds,
        lang.id,
      );

      const allBlocks = [
        ...exact.blocks.map((b) => ({ type: b.type, data: b.data })),
        ...relatedRaw.flatMap((p) =>
          p.translations.flatMap((t) => t.blocks.map((b) => ({ type: b.type, data: b.data }))),
        ),
      ];
      const imageIds = [
        (exact.post as any).coverImageId,
        ...relatedRaw.map((p) => (p as any).coverImageId),
      ];
      const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);

      return {
        post: this.mapPostDetail(exact, sectionSlugsByType, schemaMap, mediaMap),
        relatedPosts: relatedRaw
          .map((p) =>
            this.mapPostSummary(p, lang.id, lang.code, sectionSlugsByType, schemaMap, mediaMap),
          )
          .filter((p): p is SitePostSummaryDto => p !== null),
      };
    }

    // 2. Slug exists in a different language
    const anyLangMatch = await this.prisma.postTranslation.findFirst({
      where: { slug, post: { published: true, deletedAt: null } },
      include: {
        post: {
          include: {
            translations: { where: { languageId: lang.id } },
          },
        },
      },
    });

    if (!anyLangMatch) {
      throw new PostNotFoundException(slug);
    }

    const correctTranslation = anyLangMatch.post.translations[0];
    if (!correctTranslation) {
      throw new AppException(
        ErrorCodes.POST_NOT_FOUND,
        `Post "${slug}" is not available in language "${code}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    return { redirectTo: `/${code}/post/${correctTranslation.slug}` };
  }

  // ============================================================
  // PAGE + POST BUNDLE — SEO-safe, validates post belongs to page
  // ============================================================

  async getPagePostBundleByCode(
    code: string,
    pageSlug: string,
    postSlug: string,
  ): Promise<SitePagePostBundleResponseDto | SiteRedirectDto> {
    const lang = await this.strictResolveLanguage(code);

    // Pre-load canonical section slugs by post type
    const sectionSlugsByType = await this.getSectionSlugsByType();

    // 1. Try exact post match in requested language
    const exactPost = await this.findPostTranslation(postSlug, lang.id);

    if (exactPost) {
      const postType = ((exactPost.post as any).type as string) ?? 'news';
      let exactPage = (await this.findSectionPageTranslation(lang.id, postType, pageSlug)) ?? null;
      const sectionSlugs =
        sectionSlugsByType[postType] ??
        (exactPage ? this.mapPageTranslationsByCode(exactPage.page.translations) : {});
      const canonicalSectionSlug = sectionSlugs[code] ?? exactPage?.slug;

      if (!canonicalSectionSlug) {
        throw new AppException(
          ErrorCodes.PAGE_NOT_FOUND,
          `No section configured for post type "${postType}"`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Redirect if accessed via the wrong section slug
      if (pageSlug !== canonicalSectionSlug) {
        return { redirectTo: `/${code}/${canonicalSectionSlug}/${postSlug}` };
      }

      // Fetch the section page for template info
      if (!exactPage) {
        exactPage = await this.findPageTranslation(canonicalSectionSlug, lang.id);
      }

      if (!exactPage) {
        throw new PageNotFoundException(canonicalSectionSlug);
      }

      const categoryIds = exactPost.post.categories.map((cp) => cp.categoryId);
      const relatedRaw = await this.findRelatedPostsByCategories(
        exactPost.post.id,
        categoryIds,
        lang.id,
      );

      const allBlocks = [
        ...exactPost.blocks.map((b) => ({ type: b.type, data: b.data })),
        ...relatedRaw.flatMap((p) =>
          p.translations.flatMap((t) => t.blocks.map((b) => ({ type: b.type, data: b.data }))),
        ),
      ];
      const imageIds = [
        (exactPost.post as any).coverImageId,
        ...relatedRaw.map((p) => (p as any).coverImageId),
      ];
      const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);

      return {
        template: exactPage.page.template,
        page: {
          slug: exactPage.slug,
          translations: sectionSlugs,
          paths: Object.fromEntries(
            Object.entries(sectionSlugs).map(([c, s]) => [c, `/${c}/${s}`]),
          ),
        },
        post: this.mapPostDetail(exactPost, sectionSlugsByType, schemaMap, mediaMap),
        relatedPosts: relatedRaw
          .map((p) =>
            this.mapPostSummary(p, lang.id, lang.code, sectionSlugsByType, schemaMap, mediaMap),
          )
          .filter((p): p is SitePostSummaryDto => p !== null),
      };
    }

    // 2. Post slug exists but in a different language — find correct slug
    const anyPost = await this.prisma.postTranslation.findFirst({
      where: { slug: postSlug, post: { published: true, deletedAt: null } },
      include: {
        post: {
          include: {
            translations: { where: { languageId: lang.id } },
          },
        },
      },
    });

    if (!anyPost) {
      throw new PostNotFoundException(postSlug);
    }

    const correctPost = anyPost.post.translations[0];
    if (!correctPost) {
      throw new AppException(
        ErrorCodes.POST_NOT_FOUND,
        `Post "${postSlug}" is not available in language "${code}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    const postType = ((anyPost.post as any).type as string) ?? 'news';
    const sectionSlugs = sectionSlugsByType[postType] ?? {};
    const canonicalSectionSlug = sectionSlugs[code] ?? pageSlug;

    return {
      redirectTo: `/${code}/${canonicalSectionSlug}/${correctPost.slug}`,
    };
  }

  // ============================================================
  // LAYOUT (Menus + Settings) — cached per languageId
  // ============================================================

  async getLayout(languageId: number): Promise<SiteLayoutResponseDto> {
    const cached = this.layoutCache.get(languageId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const [menus, settings] = await Promise.all([
      this.loadMenus(languageId),
      this.loadLayoutSettings(languageId),
    ]);

    const result: SiteLayoutResponseDto = { menus, settings };

    this.layoutCache.set(languageId, {
      data: result,
      expiresAt: Date.now() + this.LAYOUT_CACHE_TTL_MS,
    });

    return result;
  }

  // ============================================================
  // PAGINATED POSTS BY TYPE
  // ============================================================

  async getPaginatedPostsByType(
    code: string,
    type: string,
    page: number,
    limit: number,
    categorySlug?: string,
  ): Promise<SitePostSummaryDto[]> {
    const lang = await this.strictResolveLanguage(code);
    const sectionSlugsByType = await this.getSectionSlugsByType();

    const posts = await this.prisma.post.findMany({
      where: {
        type: type,
        published: true,
        deletedAt: null,
        ...(categorySlug && {
          categories: {
            some: { category: { slug: categorySlug, isActive: true } },
          },
        }),
      } as any,
      include: {
        translations: {
          where: { languageId: lang.id },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        },
        categories: {
          where: { category: { isActive: true } },
          include: {
            category: {
              include: {
                translations: { where: { languageId: lang.id } },
              },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const allBlocks = posts.flatMap((p) =>
      p.translations.flatMap(
        (t) => (t as any).blocks?.map((b: any) => ({ type: b.type, data: b.data })) ?? [],
      ),
    );
    const imageIds = posts.map((p) => (p as any).coverImageId);
    const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);

    return posts
      .map((p) =>
        this.mapPostSummary(
          p as unknown as PostWithRelations,
          lang.id,
          lang.code,
          sectionSlugsByType,
          schemaMap,
          mediaMap,
        ),
      )
      .filter((p): p is SitePostSummaryDto => p !== null);
  }

  async search(code: string, query: string, limit = 10): Promise<SitePostSummaryDto[]> {
    const lang = await this.strictResolveLanguage(code);
    const sectionSlugsByType = await this.getSectionSlugsByType();

    // 1. Find matching post IDs across ALL languages
    const matches = await this.prisma.postTranslation.findMany({
      where: {
        post: { published: true, deletedAt: null },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { excerpt: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { postId: true },
      distinct: ['postId'],
      take: limit,
    });

    const postIds = matches.map((m) => m.postId);
    if (postIds.length === 0) return [];

    // 2. Fetch those posts with the requested language's translation
    const posts = await this.prisma.post.findMany({
      where: { id: { in: postIds }, published: true, deletedAt: null },
      include: {
        translations: {
          where: { languageId: lang.id },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        },
        categories: {
          where: { category: { isActive: true } },
          include: {
            category: {
              include: {
                translations: { where: { languageId: lang.id } },
              },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    const allBlocks = posts.flatMap((p) =>
      p.translations.flatMap(
        (t) => (t as any).blocks?.map((b: any) => ({ type: b.type, data: b.data })) ?? [],
      ),
    );
    const imageIds = posts.map((p) => (p as any).coverImageId);
    const { schemaMap, mediaMap } = await this.buildMediaContext(allBlocks, imageIds);

    return posts
      .map((p) =>
        this.mapPostSummary(
          p as unknown as PostWithRelations,
          lang.id,
          lang.code,
          sectionSlugsByType,
          schemaMap,
          mediaMap,
        ),
      )
      .filter((p): p is SitePostSummaryDto => p !== null);
  }

  async getTranslatedSlug(langCode: string, type: 'page' | 'post', slug: string) {
    const language = await this.resolveLanguageByCode(langCode);

    if (type === 'page') {
      const translation = await this.prisma.pageTranslation.findFirst({
        where: {
          slug,
          page: { published: true, deletedAt: null },
        },
        include: {
          page: {
            include: {
              translations: {
                where: { languageId: language.id },
              },
            },
          },
        },
      });

      if (!translation || translation.page.translations.length === 0) {
        throw new AppException(
          ErrorCodes.RECORD_NOT_FOUND,
          'Translation not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        slug: translation.page.translations[0].slug,
      };
    }

    if (type === 'post') {
      const translation = await this.prisma.postTranslation.findFirst({
        where: { slug },
        include: {
          post: {
            include: {
              translations: {
                where: { languageId: language.id },
              },
            },
          },
        },
      });

      if (!translation || translation.post.translations.length === 0) {
        throw new AppException(
          ErrorCodes.RECORD_NOT_FOUND,
          'Translation not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        slug: translation.post.translations[0].slug,
      };
    }

    // Unreachable for the declared 'page' | 'post' union, but the branches
    // above are value checks rather than an exhaustive switch — without this
    // an unexpected `type` would resolve the promise with undefined instead
    // of surfacing a 404.
    throw new AppException(
      ErrorCodes.RECORD_NOT_FOUND,
      'Translation not found',
      HttpStatus.NOT_FOUND,
    );
  }

  private async loadLayoutSettings(
    languageId: number,
  ): Promise<Record<string, Record<string, unknown>>> {
    const settings = await this.prisma.setting.findMany({
      where: { isActive: true },
      include: {
        settingLocalizedContent: { where: { languageId } },
        settingGlobalContent: true,
      },
    });

    const aggregated = this.aggregateSettings(settings as SettingWithRelations[]);

    // Resolve any media references inside setting values
    const mediaIds = [...new Set(this.collectMediaIds(aggregated))];
    if (mediaIds.length === 0) return aggregated;

    const records = await this.prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: {
        id: true,
        url: true,
        mimeType: true,
        originalName: true,
        size: true,
        width: true,
        height: true,
        alt: true,
        caption: true,
      },
    });

    const mediaMap = new Map<number, SiteMediaDto>(records.map((m) => [m.id, m as SiteMediaDto]));

    return this.injectMediaData(aggregated, mediaMap);
  }

  private aggregateSettings(
    settings: SettingWithRelations[],
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const setting of settings) {
      const localizedRaw = setting.settingLocalizedContent?.[0]?.value;
      const globalRaw = setting.settingGlobalContent?.value;

      const localized =
        localizedRaw && typeof localizedRaw === 'object' && !Array.isArray(localizedRaw)
          ? (localizedRaw as Record<string, unknown>)
          : {};

      const global =
        globalRaw && typeof globalRaw === 'object' && !Array.isArray(globalRaw)
          ? (globalRaw as Record<string, unknown>)
          : {};

      result[setting.key] = {
        ...global,
        ...localized,
      };
    }

    return result;
  }

  // ============================================================
  // PRIVATE — Prisma Queries
  // ============================================================

  /**
   * Load canonical section page slugs keyed by post type and locale.
   * e.g. { news: { ka: "სიახლეები", en: "news" }, success: {...}, course: {...} }
   */
  private async getSectionSlugsByType(): Promise<Record<string, Record<string, string>>> {
    const pages = await (this.prisma.page as any).findMany({
      where: {
        published: true,
        deletedAt: null,
      },
      include: {
        template: { select: { postType: true, slug: true } },
        translations: { include: { language: { select: { code: true } } } },
      },
    });

    const result: Record<string, Record<string, string>> = {};
    const explicitPages = pages.filter((page: any) => page.template?.postType);
    const inferredPages = pages.filter((page: any) => !page.template?.postType);

    for (const page of explicitPages) {
      const postType = page.template.postType as string;
      result[postType] = this.mapPageTranslationsByCode(page.translations as any[]);
    }

    for (const page of inferredPages) {
      const postType = this.inferPostTypeFromPage(page);
      if (!postType || result[postType]) continue;
      result[postType] = this.mapPageTranslationsByCode(page.translations as any[]);
    }

    return result;
  }

  private async findSectionPageTranslation(
    languageId: number,
    postType: string,
    requestedSlug?: string,
  ): Promise<PageTranslationWithRelations | null> {
    if (requestedSlug) {
      const requestedPage = await this.findPageTranslation(requestedSlug, languageId);
      if (requestedPage && this.inferPostTypeFromPage(requestedPage.page) === postType) {
        return requestedPage;
      }
    }

    return this.prisma.pageTranslation.findFirst({
      where: {
        languageId,
        page: {
          published: true,
          deletedAt: null,
          OR: [
            { template: { postType: postType as any } },
            { translations: { some: { slug: postType } } },
            { template: { slug: postType } },
          ],
        },
      },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        page: {
          include: {
            template: true,
            translations: {
              include: {
                language: true,
              },
            },
            posts: {
              where: { published: true, deletedAt: null },
              include: {
                translations: {
                  where: { languageId },
                  include: {
                    blocks: { orderBy: { sortOrder: 'asc' } },
                  },
                },
                categories: {
                  include: {
                    category: {
                      include: {
                        translations: { where: { languageId } },
                      },
                    },
                  },
                },
              },
              orderBy: { publishedAt: 'desc' },
            },
          },
        },
      },
    }) as unknown as PageTranslationWithRelations | null;
  }

  private async findHomePageTranslation(
    languageId: number,
  ): Promise<PageTranslationWithRelations | null> {
    return this.prisma.pageTranslation.findFirst({
      where: {
        languageId,
        page: { isHome: true, published: true, deletedAt: null },
      },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        page: {
          include: {
            template: true,
            translations: {
              include: {
                language: true,
              },
            },
            posts: {
              where: { published: true, deletedAt: null },
              include: {
                translations: {
                  where: { languageId },
                  include: {
                    blocks: { orderBy: { sortOrder: 'asc' } },
                  },
                },
                categories: {
                  include: {
                    category: {
                      include: {
                        translations: { where: { languageId } },
                      },
                    },
                  },
                },
              },
              orderBy: { publishedAt: 'desc' },
            },
          },
        },
      },
    }) as unknown as PageTranslationWithRelations | null;
  }

  private async findPageTranslation(
    slug: string,
    languageId: number,
  ): Promise<PageTranslationWithRelations | null> {
    return this.prisma.pageTranslation.findFirst({
      where: {
        slug,
        languageId,
        page: { published: true, deletedAt: null },
      },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        page: {
          include: {
            template: true,
            translations: {
              include: {
                language: true,
              },
            },
            posts: {
              where: { published: true, deletedAt: null },
              include: {
                translations: {
                  where: { languageId },
                  include: {
                    blocks: { orderBy: { sortOrder: 'asc' } },
                  },
                },
                categories: {
                  include: {
                    category: {
                      include: {
                        translations: { where: { languageId } },
                      },
                    },
                  },
                },
              },
              orderBy: { publishedAt: 'desc' },
            },
          },
        },
      },
    }) as unknown as PageTranslationWithRelations | null;
  }

  private async findPostTranslation(
    slug: string,
    languageId: number,
  ): Promise<PostTranslationWithRelations | null> {
    return this.prisma.postTranslation.findFirst({
      where: {
        slug,
        languageId,
        post: { published: true, deletedAt: null },
      },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        post: {
          include: {
            categories: {
              where: { category: { isActive: true } },
              include: {
                category: {
                  include: {
                    translations: { where: { languageId } },
                  },
                },
              },
            },
            translations: {
              include: { language: { select: { code: true } } },
            },
          },
        },
      },
    }) as unknown as PostTranslationWithRelations | null;
  }

  private async findRelatedPostsByCategories(
    currentPostId: number,
    categoryIds: number[],
    languageId: number,
    limit = 6,
  ): Promise<PostWithRelations[]> {
    if (categoryIds.length === 0) return [];

    const posts = await this.prisma.post.findMany({
      where: {
        id: { not: currentPostId },
        published: true,
        deletedAt: null,
        categories: {
          some: {
            categoryId: { in: categoryIds },
          },
        },
      },
      include: {
        translations: {
          where: { languageId },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        },
        categories: {
          where: { category: { isActive: true } },
          include: {
            category: {
              include: {
                translations: { where: { languageId } },
              },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    return posts as unknown as PostWithRelations[];
  }

  // ============================================================
  // MENU
  // ============================================================

  private async loadMenus(languageId: number): Promise<SiteMenuDto[]> {
    const menus = await this.prisma.menu.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: { isActive: true },
          include: {
            translations: { where: { languageId } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return menus.map((menu) => ({
      id: menu.id,
      title: menu.title,
      slug: menu.slug,
      items: this.buildMenuTree(menu.items as MenuItemWithTranslations[], null),
    }));
  }

  private buildMenuTree(
    items: MenuItemWithTranslations[],
    parentId: number | null,
  ): SiteMenuItemDto[] {
    return items
      .filter((i) => i.parentId === parentId)
      .map((item) => {
        const translation = item.translations[0] ?? null;

        return {
          id: item.id,
          type: item.type,
          url: item.url,
          target: item.target,
          label: translation?.label ?? '',
          slug: translation?.slug ?? '',
          sortOrder: item.sortOrder,
          referenceId: item.referenceId,
          children: this.buildMenuTree(items, item.id),
        };
      });
  }

  // ============================================================
  // MAPPERS
  // ============================================================

  private mapLanguage = (lang: Language): SiteLanguageDto => ({
    id: lang.id,
    code: lang.code,
    name: lang.name,
    englishName: lang.englishName,
    georgianName: lang.georgianName,
    flagEmoji: lang.flagEmoji,
    direction: lang.direction,
    isDefault: lang.isDefault,
    sortOrder: lang.sortOrder,
  });

  private mapPage(
    pt: PageTranslationWithRelations,
    _schemaMap: Map<string, SchemaField[]> = new Map(),
    mediaMap: Map<number, SiteMediaDto> = new Map(),
  ): SitePageDto {
    const translationsByCode = this.mapPageTranslationsByCode(pt.page.translations);
    return {
      id: pt.page.id,
      slug: pt.slug,
      title: pt.title,
      subtitle: pt.subtitle,
      excerpt: pt.excerpt,
      content: pt.content,
      description: pt.description,
      metaTitle: pt.metaTitle,
      metaDescription: pt.metaDescription,
      keywords: pt.keywords,
      focusKeyword: pt.focusKeyword,
      canonicalUrl: pt.canonicalUrl,
      featureImage: this.resolveMediaDto(mediaMap.get((pt.page as any).featureImageId)),
      isHome: pt.page.isHome,
      translations: translationsByCode,
      paths: Object.fromEntries(
        Object.entries(translationsByCode).map(([code, slug]) => [code, `/${code}/${slug}`]),
      ),
      template: {
        id: pt.page.template.id,
        slug: pt.page.template.slug,
      },
      blocks: pt.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        data: this.injectMediaData(b.data, mediaMap),
        sortOrder: b.sortOrder,
      })),
    };
  }

  private mapPostDetail(
    pt: PostTranslationWithRelations,
    sectionSlugsByType?: Record<string, Record<string, string>>,
    _schemaMap: Map<string, SchemaField[]> = new Map(),
    mediaMap: Map<number, SiteMediaDto> = new Map(),
  ): SitePostDetailDto {
    const postType = ((pt.post as any).type as string) ?? 'news';
    const postSlugsByCode = Object.fromEntries(
      pt.post.translations.map((t) => [t.language.code, t.slug]),
    );

    const sectionSlugs = sectionSlugsByType?.[postType] ?? {};
    const paths = Object.fromEntries(
      Object.entries(postSlugsByCode)
        .filter(([code]) => sectionSlugs[code])
        .map(([code, postSlug]) => [code, `/${code}/${sectionSlugs[code]}/${postSlug}`]),
    );

    return {
      id: pt.post.id,
      slug: pt.slug,
      type: postType,
      translations: postSlugsByCode,
      paths,
      title: pt.title,
      excerpt: pt.excerpt,
      content: pt.content,
      metaTitle: pt.metaTitle,
      metaDescription: pt.metaDescription,
      coverImage: this.resolveMediaDto(mediaMap.get((pt.post as any).coverImageId)),
      publishedAt: pt.post.publishedAt?.toISOString() ?? null,
      viewCount: pt.post.viewCount,
      blocks: pt.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        data: this.injectMediaData(b.data, mediaMap),
        sortOrder: b.sortOrder,
      })),
      categories: pt.post.categories.map((cp) => this.mapCategory(cp)),
    };
  }

  private mapCategory(cp: CategoryPostWithCategory): SiteCategoryDto {
    const cat = cp.category;
    const translation = cat.translations[0] ?? null;

    return {
      id: cat.id,
      slug: cat.slug,
      name: translation?.name ?? cat.slug,
      description: translation?.description ?? null,
    };
  }

  private mapPostSummary(
    post: PostWithRelations,
    _languageId: number,
    localeCode?: string,
    sectionSlugsByType?: Record<string, Record<string, string>>,
    _schemaMap: Map<string, SchemaField[]> = new Map(),
    mediaMap: Map<number, SiteMediaDto> = new Map(),
  ): SitePostSummaryDto | null {
    const translation = post.translations[0] ?? null;
    if (!translation) return null;

    const postType = ((post as any).type as string) ?? 'news';
    const sectionSlugs = sectionSlugsByType?.[postType] ?? {};

    const paths: Record<string, string> = {};
    if (localeCode && sectionSlugs[localeCode]) {
      paths[localeCode] = `/${localeCode}/${sectionSlugs[localeCode]}/${translation.slug}`;
    }

    return {
      id: post.id,
      slug: translation.slug,
      type: postType,
      paths,
      title: translation.title,
      excerpt: translation.excerpt,
      coverImage: this.resolveMediaDto(mediaMap.get((post as any).coverImageId)),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      categories: post.categories.map((cp) => this.mapCategory(cp)),
      blocks: translation.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        data: this.injectMediaData(b.data, mediaMap),
        sortOrder: b.sortOrder,
      })),
    };
  }

  private async buildGroupedPosts(
    posts: PostWithRelations[],
    languageId: number,
    localeCode?: string,
    schemaMap: Map<string, SchemaField[]> = new Map(),
    mediaMap: Map<number, SiteMediaDto> = new Map(),
  ): Promise<SitePostsGroupedDto> {
    const sectionSlugsByType = await this.getSectionSlugsByType();

    const all = posts
      .map((p) =>
        this.mapPostSummary(p, languageId, localeCode, sectionSlugsByType, schemaMap, mediaMap),
      )
      .filter((p): p is SitePostSummaryDto => p !== null);

    return {
      categories: [],
      grouped: { all },
    };
  }

  private mapPageTranslationsByCode(
    translations: Array<{ language: { code: string }; slug: string }>,
  ): Record<string, string> {
    return Object.fromEntries(
      translations.map((translation) => [translation.language.code, translation.slug]),
    );
  }

  private inferPostTypeFromPage(page: {
    template?: { postType?: string | null; slug?: string | null } | null;
    translations?: Array<{ slug: string }>;
  }): SupportedPostType | null {
    const explicitType = page.template?.postType;
    if (explicitType && this.isSupportedPostType(explicitType)) {
      return explicitType;
    }

    const matchedTranslation = page.translations?.find((translation) =>
      this.isSupportedPostType(translation.slug),
    );
    if (matchedTranslation) {
      return matchedTranslation.slug as SupportedPostType;
    }

    const templateSlug = page.template?.slug;
    if (templateSlug && this.isSupportedPostType(templateSlug)) {
      return templateSlug;
    }

    return null;
  }

  private isSupportedPostType(value: string): value is SupportedPostType {
    return POST_TYPES.includes(value as SupportedPostType);
  }
}
