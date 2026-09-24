// src/modules/pages/application/page.service.ts

import { Injectable, Inject } from '@nestjs/common';

import { PageAggregate } from '../domain/page.aggregate';

import { PageFilters, IPageAggregateRepository } from '../domain';

import { PageQueryDto, PageListItemDto, PagePaginatedQueryDto } from '../dto';

import { PageMapper } from '../api/mappers/page.mapper';
import {
  PaginatedResponseDto,
  PaginatedResult,
  PaginationOptions,
  PaginationQueryDto,
} from '@/common/pagination';
import { PageVersion } from '@prisma/client';
import { PageNotFoundException, InvalidBulkActionException } from '@/common/exceptions';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/application/notifications.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { PagesPermissions } from './pages.permissions';

@Injectable()
export class PagesService {
  constructor(
    @Inject('IPageAggregateRepository')
    private readonly pageAggregateRepository: IPageAggregateRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================
  // AGGREGATE OPERATIONS
  // ==========================================

  async createAggregate(
    aggregate: PageAggregate,
    createdById?: number,
    meta?: ActionMeta,
  ): Promise<PageAggregate> {
    const created = await this.pageAggregateRepository.create(aggregate, createdById);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PagesPermissions.CREATE_PAGES,
      targetType: 'page',
      targetId: created.id ?? undefined,
      after: {
        translations: created.translations.map((t) => ({
          languageId: t.languageId,
          title: t.title,
          slug: t.slug,
        })),
      },
      ip: meta?.ip,
    });
    return created;
  }

  async findAggregateById(id: number): Promise<PageAggregate> {
    const page = await this.pageAggregateRepository.findById(id);

    if (!page) {
      throw new PageNotFoundException(id);
    }

    return page;
  }

  async findAggregateBySlug(slug: string, languageId: number): Promise<PageAggregate> {
    const page = await this.pageAggregateRepository.findBySlug(slug, languageId);

    if (!page) {
      throw new PageNotFoundException(slug);
    }

    return page;
  }

  async findAllAggregates(
    query?: PageQueryDto,
    pagination?: PaginationOptions,
  ): Promise<PageAggregate[]> {
    const filters = this.mapQueryToFilters(query);
    return this.pageAggregateRepository.findAll(filters, pagination);
  }

  // ==========================================
  // UPDATE + VERSIONING
  // ==========================================
  async updateAggregate(
    id: number,
    aggregate: Partial<PageAggregate>,
    updatedById?: number,
    meta?: ActionMeta,
  ): Promise<PageAggregate> {
    const existing = await this.findAggregateById(id);

    if (existing.deletedAt) {
      throw new PageNotFoundException(id);
    }

    // ==========================================
    // ✅ VERSION SNAPSHOT (ONLY UPDATED LANGUAGES)
    // ==========================================
    if (aggregate.translations?.length) {
      for (const updatedTranslation of aggregate.translations) {
        const oldTranslation = existing.translations.find(
          (t) => t.languageId === updatedTranslation.languageId,
        );

        if (!oldTranslation) continue;

        // ✅ Only create version if something changed
        const changed =
          oldTranslation.title !== updatedTranslation.title ||
          oldTranslation.slug !== updatedTranslation.slug ||
          oldTranslation.content !== updatedTranslation.content ||
          JSON.stringify(oldTranslation.blocks) !== JSON.stringify(updatedTranslation.blocks);

        if (changed) {
          await this.pageAggregateRepository.createVersion(id, oldTranslation.languageId, {
            translation: oldTranslation,
            updatedAt: new Date(),
          });
        }
      }
    }

    // ==========================================
    // ✅ UPDATE PAGE
    // ==========================================
    const updated = await this.pageAggregateRepository.update(id, aggregate, updatedById);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PagesPermissions.UPDATE_PAGES,
      targetType: 'page',
      targetId: id,
      after: {
        translations: (aggregate.translations ?? []).map((t) => ({
          languageId: t.languageId,
          title: t.title,
          slug: t.slug,
        })),
      },
      ip: meta?.ip,
    });
    return updated;
  }

  // ==========================================
  // TRASH (SOFT DELETE) OPERATIONS
  // ==========================================

  async softDelete(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.pageAggregateRepository.softDelete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PagesPermissions.DELETE_PAGES,
      targetType: 'page',
      targetId: id,
      ip: meta?.ip,
    });
    await this.notificationsService.create({
      type: 'page.trashed',
      title: 'Page moved to trash',
      message: `Page #${id} was moved to trash.`,
      link: `/pages/trash`,
      actorId: meta?.actorId,
    });
  }

  async restore(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.pageAggregateRepository.restore(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PagesPermissions.DELETE_PAGES,
      targetType: 'page',
      targetId: id,
      ip: meta?.ip,
    });
  }

  async hardDelete(id: number, meta?: ActionMeta): Promise<void> {
    await this.findAggregateById(id);
    await this.pageAggregateRepository.hardDelete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PagesPermissions.DELETE_PAGES,
      targetType: 'page',
      targetId: id,
      ip: meta?.ip,
    });
    await this.notificationsService.create({
      type: 'page.deleted',
      title: 'Page permanently deleted',
      message: `Page #${id} was permanently deleted.`,
      actorId: meta?.actorId,
    });
  }

  async getDeletedPages(languageId: number): Promise<PageListItemDto[]> {
    const deleted = await this.pageAggregateRepository.findDeleted();
    return PageMapper.toListItems(deleted, languageId);
  }

  // ==========================================
  // LIST OPERATIONS
  // ==========================================

  async findAllList(query?: PageQueryDto, languageId: number = 1): Promise<PageListItemDto[]> {
    const filters = this.mapQueryToFilters(query);
    const aggregates = await this.pageAggregateRepository.findAll(filters);

    return PageMapper.toListItems(aggregates, languageId);
  }

  async findAllListPaginated(query: PagePaginatedQueryDto, languageId: number = 1) {
    const filters = this.mapQueryToFilters(query);

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.pageAggregateRepository.findPaginated(filters, paginationOptions);

    return new PaginatedResponseDto<PageListItemDto>(
      PageMapper.toListItems(result.data, languageId),
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async findChildrenList(parentId: number, languageId: number = 1): Promise<PageListItemDto[]> {
    const children = await this.pageAggregateRepository.findChildren(parentId);
    return PageMapper.toListItems(children, languageId);
  }

  // ==========================================
  // SLUG UTILITY
  // ==========================================

  async isSlugUnique(slug: string, languageId: number, excludePageId?: number): Promise<boolean> {
    return this.pageAggregateRepository.isSlugUnique(slug, languageId, excludePageId);
  }

  // ==========================================
  // VERSION OPERATIONS
  // ==========================================

  async getVersions(pageId: number, query: PagePaginatedQueryDto) {
    await this.findAggregateById(pageId);

    const paginationOptions: PaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.pageAggregateRepository.getVersions(pageId, paginationOptions);

    return new PaginatedResponseDto<PageVersion>(
      result.data,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async restoreVersion(versionId: number): Promise<void> {
    await this.pageAggregateRepository.restoreVersion(versionId);
  }

  // ==========================================
  // BULK + REORDER OPERATIONS
  // ==========================================

  async reorderPages(updates: Array<{ id: number; sortOrder: number }>): Promise<void> {
    await this.pageAggregateRepository.reorder(updates);
  }

  async bulkAction(
    ids: number[],
    action: 'publish' | 'unpublish' | 'delete' | 'restore' | 'hardDelete',
    meta?: ActionMeta,
  ): Promise<void> {
    switch (action) {
      case 'publish':
        await this.pageAggregateRepository.publishMany(ids);
        break;

      case 'unpublish':
        await this.pageAggregateRepository.unpublishMany(ids);
        break;

      case 'delete':
        // Soft delete
        await this.pageAggregateRepository.softDeleteMany(ids);
        break;

      case 'restore':
        await this.pageAggregateRepository.restoreMany(ids);
        break;

      case 'hardDelete':
        await this.pageAggregateRepository.hardDeleteMany(ids);
        break;

      default:
        throw new InvalidBulkActionException(action);
    }

    await this.auditService.log({
      actorId: meta?.actorId,
      action:
        action === 'publish' || action === 'unpublish'
          ? PagesPermissions.PUBLISH_PAGES
          : PagesPermissions.DELETE_PAGES,
      targetType: 'page',
      after: { ids, action },
      ip: meta?.ip,
    });

    if (action === 'publish') {
      await this.notificationsService.create({
        type: 'page.published',
        title: 'Pages published',
        message: `${ids.length} page(s) were published.`,
        link: `/pages`,
        actorId: meta?.actorId,
      });
    } else if (action === 'hardDelete') {
      await this.notificationsService.create({
        type: 'page.bulk_deleted',
        title: 'Pages permanently deleted',
        message: `${ids.length} page(s) were permanently deleted.`,
        actorId: meta?.actorId,
      });
    }
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private mapQueryToFilters(query?: PageQueryDto): PageFilters {
    if (!query) return {};

    return {
      published: query.published,
      showInMenu: query.showInMenu,
      isHome: query.isHome,
      parentId: query.parentId,
      templateId: query.templateId,
    };
  }

  // ==========================================
  // PUBLIC PAGE OPERATIONS
  // ==========================================

  async findHomepage(languageId: number): Promise<PageAggregate | null> {
    const pages = await this.pageAggregateRepository.findAll({
      published: true,
      isHome: true,
    });

    if (pages.length === 0) return null;

    return (
      pages.find((page) => page.translations.some((t) => t.languageId === languageId)) ?? pages[0]
    );
  }

  async findMenuPages(_languageId: number): Promise<PageAggregate[]> {
    return this.pageAggregateRepository.findAll({
      published: true,
      showInMenu: true,
    });
  }

  async getBreadcrumbs(
    id: number,
    languageId: number,
  ): Promise<Array<{ id: number; slug: string; title: string }>> {
    const breadcrumbs: Array<{ id: number; slug: string; title: string }> = [];

    let current = await this.pageAggregateRepository.findById(id);

    while (current) {
      const translation =
        current.translations.find((t) => t.languageId === languageId) ?? current.translations[0];

      if (translation) {
        breadcrumbs.unshift({
          id: current.id!,
          slug: translation.slug,
          title: translation.title,
        });
      }

      if (current.parentId) {
        current = await this.pageAggregateRepository.findById(current.parentId);
      } else {
        break;
      }
    }

    return breadcrumbs;
  }

  async findPublishedById(id: number, languageId: number): Promise<PageAggregate | null> {
    const page = await this.pageAggregateRepository.findById(id);

    // Must exist + must be published
    if (!page || !page.published) return null;

    // ✅ Must have translation for requested language
    const hasTranslation = page.translations.some((t) => t.languageId === languageId);

    if (!hasTranslation) return null;

    return page;
  }

  // NOTE: languageId is accepted but not applied to the query — the repository
  // returns every published page regardless of language. Flagged when strict
  // unused-parameter checking was enabled; left as-is here because changing
  // the filter would alter public site output.
  async findPublishedPagesPaginated(
    _languageId: number,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<PageAggregate>> {
    return this.pageAggregateRepository.findPaginated({ published: true }, pagination);
  }

  async findPublishedChildren(parentId: number, languageId: number): Promise<PageAggregate[]> {
    const children = await this.pageAggregateRepository.findChildren(parentId);

    return children.filter((child) => {
      if (!child.published) return false;

      // ✅ Only include if translation exists
      return child.translations.some((t) => t.languageId === languageId);
    });
  }

  async findPublishedPages(languageId: number): Promise<PageAggregate[]> {
    const pages = await this.pageAggregateRepository.findAll({
      published: true,
    });

    // ✅ Only keep pages that contain translation for this language
    return pages.filter((page) => page.translations.some((t) => t.languageId === languageId));
  }

  async findPublishedBySlug(slug: string, languageId: number): Promise<PageAggregate | null> {
    const page = await this.pageAggregateRepository.findBySlug(slug, languageId);

    // not found / not published
    if (!page || !page.published) return null;

    // ✅ translation must exist for this language
    const hasTranslation = page.translations.some((t) => t.languageId === languageId);
    if (!hasTranslation) return null;

    // ✅ if you support soft delete on Page (deletedAt)
    // (only do this if PageAggregate includes deletedAt)
    if ((page as any).deletedAt) return null;

    return page;
  }

  async findPublishedSiblings(id: number, languageId: number): Promise<PageAggregate[]> {
    // 1️⃣ Load current page
    const page = await this.pageAggregateRepository.findById(id);

    if (!page) {
      throw new PageNotFoundException(id);
    }

    // 2️⃣ Find siblings = same parent, published only
    const siblings = await this.pageAggregateRepository.findAll({
      parentId: page.parentId,
      published: true,
    });

    // 3️⃣ Filter out:
    // - current page itself
    // - pages missing translation for languageId
    // - trashed pages (if deletedAt exists)
    return siblings.filter((sibling) => {
      if (sibling.id === id) return false;

      // must have translation in requested language
      const hasTranslation = sibling.translations.some((t) => t.languageId === languageId);
      if (!hasTranslation) return false;

      // if soft delete exists
      if ((sibling as any).deletedAt) return false;

      return true;
    });
  }

  async findAllPublishedSlugs(languageId: number): Promise<string[]> {
    const pages = await this.pageAggregateRepository.findAll({ published: true });

    const slugs: string[] = [];

    for (const page of pages) {
      if ((page as any).deletedAt) continue;

      const translation = page.translations.find((t) => t.languageId === languageId);
      if (translation) {
        slugs.push(translation.slug);
      }
    }

    return slugs;
  }

  async findPublishedByTemplate(templateId: number, languageId: number): Promise<PageAggregate[]> {
    // 1️⃣ Find all pages using this template + published
    const pages = await this.pageAggregateRepository.findAll({
      templateId,
      published: true,
    });

    // 2️⃣ Return only pages that:
    // - have translation for requested language
    // - are not soft deleted (trash)
    return pages.filter((page) => {
      // must have correct translation
      const hasTranslation = page.translations.some((t) => t.languageId === languageId);
      if (!hasTranslation) return false;

      // must not be trashed
      if ((page as any).deletedAt) return false;

      return true;
    });
  }
}
