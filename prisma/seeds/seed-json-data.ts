// prisma/seeds/seed-json-data.ts
// Restores all content from prisma/seeds/seed_data.json.
// Safe to re-run — uses upsert throughout.

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = createPrismaClient();
const DATA_FILE = path.join(__dirname, 'seed_data.json');

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.warn(`⚠️  seed_data.json not found at ${DATA_FILE} — skipping.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  const log = (label: string, count: number) => console.log(`  ✅ ${label}: ${count} rows`);

  // ─── Languages ────────────────────────────────────────────────
  if (data.languages?.length) {
    for (const r of data.languages) {
      const { id, ...rest } = r;
      await prisma.language.upsert({ where: { id }, update: rest, create: { id, ...rest } });
    }
    log('languages', data.languages.length);
  }

  // ─── Permissions ──────────────────────────────────────────────
  // Delete dependents first so we can safely recreate with new sequential IDs
  if (data.permissions?.length) {
    await prisma.userPermission.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.permission.deleteMany({});
    for (const r of data.permissions) {
      await prisma.permission.create({ data: r });
    }
    log('permissions', data.permissions.length);
  }

  // ─── Roles ────────────────────────────────────────────────────
  if (data.roles?.length) {
    for (const r of data.roles) {
      const { id, permissions, users, ...rest } = r;
      await prisma.role.upsert({ where: { id }, update: rest, create: { id, ...rest } });
    }
    log('roles', data.roles.length);
  }

  // ─── Role Permissions ─────────────────────────────────────────
  if (data.rolePermissions?.length) {
    const validPermissionIds = new Set((data.permissions ?? []).map((p: any) => p.id));
    const validRolePermissions = data.rolePermissions.filter((rp: any) =>
      validPermissionIds.has(rp.permissionId),
    );
    await prisma.rolePermission.createMany({ data: validRolePermissions, skipDuplicates: true });
    log('rolePermissions', validRolePermissions.length);
  }

  // ─── Role Management (who can CRUD whose accounts) ────────────
  if (data.roleManagement?.length) {
    for (const r of data.roleManagement) {
      await prisma.roleManagement.upsert({
        where: {
          managerRoleSlug_managedRoleSlug: {
            managerRoleSlug: r.managerRoleSlug,
            managedRoleSlug: r.managedRoleSlug,
          },
        },
        update: {},
        create: {
          managerRoleSlug: r.managerRoleSlug,
          managedRoleSlug: r.managedRoleSlug,
        },
      });
    }
    log('roleManagement', data.roleManagement.length);
  }

  // ─── Users ────────────────────────────────────────────────────
  // avatarMediaId is seeded in a second pass after media rows exist
  if (data.users?.length) {
    for (const r of data.users) {
      const { id, avatarMediaId, ...rest } = r;
      await prisma.user.upsert({
        where: { id },
        update: {
          firstName: r.firstName,
          lastName: r.lastName,
          displayName: r.displayName,
          email: r.email,
          isActive: r.isActive,
        },
        create: { id, avatarMediaId: null, ...rest },
      });
    }
    log('users', data.users.length);
  }

  if (data.userRoles?.length) {
    for (const r of data.userRoles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: r.userId, roleId: r.roleId } },
        update: {},
        create: { userId: r.userId, roleId: r.roleId },
      });
    }
    log('userRoles', data.userRoles.length);
  }

  if (data.userPermissions?.length) {
    await prisma.userPermission.createMany({ data: data.userPermissions, skipDuplicates: true });
    log('userPermissions', data.userPermissions.length);
  }

  // ─── Block Type Definitions ───────────────────────────────────
  const blockTypes = data.blockTypeDefinitions ?? data.blockTypes ?? [];
  if (blockTypes.length) {
    for (const r of blockTypes) {
      const { id, ...rest } = r;
      await prisma.blockTypeDefinition.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }
    log('blockTypeDefinitions', blockTypes.length);
  }

  // ─── Page Templates ───────────────────────────────────────────
  if (data.pageTemplates?.length) {
    for (const t of data.pageTemplates) {
      const { translations, ...rest } = t;
      const { id, ...tRest } = rest;
      await prisma.pageTemplate.upsert({
        where: { id },
        update: {
          slug: tRest.slug,
          postType: tRest.postType ?? null,
          createdById: tRest.createdById ?? null,
          updatedById: tRest.updatedById ?? null,
        },
        create: {
          id,
          slug: tRest.slug,
          postType: tRest.postType ?? null,
          createdById: tRest.createdById ?? null,
          updatedById: tRest.updatedById ?? null,
        },
      });
      for (const tr of translations ?? []) {
        await prisma.pageTemplateTranslation.upsert({
          where: { id: tr.id },
          update: { name: tr.name },
          create: {
            id: tr.id,
            templateId: tr.templateId,
            languageId: tr.languageId,
            name: tr.name,
          },
        });
      }
    }
    log('pageTemplates', data.pageTemplates.length);
  }

  // ─── Media Folders ────────────────────────────────────────────
  // Must come before pages/posts which reference media via FK
  if (data.mediaFolders?.length) {
    for (const f of data.mediaFolders) {
      const { id, parentId, ...rest } = f;
      await prisma.mediaFolder.upsert({
        where: { id },
        update: { name: rest.name, slug: rest.slug, scope: rest.scope, order: rest.order },
        create: { id, parentId: null, ...rest },
      });
    }
    for (const f of data.mediaFolders) {
      if (f.parentId) {
        await prisma.mediaFolder.update({ where: { id: f.id }, data: { parentId: f.parentId } });
      }
    }
    log('mediaFolders', data.mediaFolders.length);
  }

  // ─── Media ────────────────────────────────────────────────────
  // Must come before pages/posts (featureImageId / coverImageId FKs)
  if (data.media?.length) {
    for (const m of data.media) {
      await prisma.media.upsert({
        where: { id: m.id },
        update: {
          alt: m.alt ?? null,
          caption: m.caption ?? null,
          tags: m.tags ?? [],
          scope: m.scope ?? 'cms',
          legacyFolder: m.legacyFolder ?? m.folder ?? 'general',
          folderId: m.folderId ?? null,
        },
        create: {
          id: m.id,
          filename: m.filename,
          originalName: m.originalName,
          path: m.path,
          url: m.url,
          mimeType: m.mimeType,
          size: m.size,
          width: m.width ?? null,
          height: m.height ?? null,
          legacyFolder: m.legacyFolder ?? m.folder ?? 'general',
          folderId: m.folderId ?? null,
          scope: m.scope ?? 'cms',
          tags: m.tags ?? [],
          alt: m.alt ?? null,
          caption: m.caption ?? null,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
        },
      });
    }
    log('media', data.media.length);
  }

  // ─── User avatars (second pass — media must exist first) ──────
  if (data.users?.length) {
    for (const r of data.users) {
      if (r.avatarMediaId) {
        await prisma.user.update({
          where: { id: r.id },
          data: { avatarMediaId: r.avatarMediaId },
        });
      }
    }
  }

  // ─── Pages ────────────────────────────────────────────────────
  if (data.pages?.length) {
    // First pass: create without parentId to avoid FK order issues
    for (const p of data.pages) {
      await prisma.page.upsert({
        where: { id: p.id },
        update: {
          templateId: p.templateId,
          sortOrder: p.sortOrder,
          published: p.published,
          showInMenu: p.showInMenu,
          isHome: p.isHome,
          featureImageId: p.featureImageId ?? null,
          createdById: p.createdById ?? null,
          updatedById: p.updatedById ?? null,
          deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
        },
        create: {
          id: p.id,
          parentId: null,
          templateId: p.templateId,
          sortOrder: p.sortOrder,
          published: p.published,
          showInMenu: p.showInMenu,
          isHome: p.isHome,
          featureImageId: p.featureImageId ?? null,
          createdById: p.createdById ?? null,
          updatedById: p.updatedById ?? null,
          deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      });
    }
    // Second pass: wire parentId
    for (const p of data.pages) {
      if (p.parentId) {
        await prisma.page.update({ where: { id: p.id }, data: { parentId: p.parentId } });
      }
    }
    // Translations + blocks + slug aliases
    for (const p of data.pages) {
      for (const tr of p.translations ?? []) {
        const translation = await prisma.pageTranslation.upsert({
          where: { id: tr.id },
          update: {
            title: tr.title,
            slug: tr.slug,
            subtitle: tr.subtitle ?? null,
            excerpt: tr.excerpt ?? null,
            content: tr.content ?? null,
            description: tr.description ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
            keywords: tr.keywords ?? null,
            focusKeyword: tr.focusKeyword ?? null,
            canonicalUrl: tr.canonicalUrl ?? null,
            publishedAt: tr.publishedAt ? new Date(tr.publishedAt) : null,
          },
          create: {
            id: tr.id,
            pageId: tr.pageId,
            languageId: tr.languageId,
            title: tr.title,
            slug: tr.slug,
            subtitle: tr.subtitle ?? null,
            excerpt: tr.excerpt ?? null,
            content: tr.content ?? null,
            description: tr.description ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
            keywords: tr.keywords ?? null,
            focusKeyword: tr.focusKeyword ?? null,
            canonicalUrl: tr.canonicalUrl ?? null,
            publishedAt: tr.publishedAt ? new Date(tr.publishedAt) : null,
          },
        });
        if (tr.blocks?.length) {
          await prisma.pageContentBlock.deleteMany({ where: { translationId: translation.id } });
          await prisma.pageContentBlock.createMany({
            data: tr.blocks.map((b: any) => ({
              id: b.id,
              translationId: translation.id,
              type: b.type,
              data: b.data,
              sortOrder: b.sortOrder ?? 0,
            })),
          });
        }
      }
      for (const alias of p.slugAliases ?? []) {
        await prisma.pageSlugAlias.upsert({
          where: { id: alias.id },
          update: { slug: alias.slug },
          create: {
            id: alias.id,
            pageId: alias.pageId,
            languageId: alias.languageId,
            slug: alias.slug,
          },
        });
      }
    }
    log('pages', data.pages.length);
  }

  // ─── Post Categories ──────────────────────────────────────────
  const categories = data.postCategories ?? data.post_categories ?? [];
  if (categories.length) {
    for (const c of categories) {
      await prisma.postCategory.upsert({
        where: { id: c.id },
        update: { slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive },
        create: {
          id: c.id,
          parentId: c.parentId ?? null,
          slug: c.slug,
          sortOrder: c.sortOrder ?? 0,
          isActive: c.isActive ?? true,
        },
      });
      for (const tr of c.translations ?? []) {
        await prisma.postCategoryTranslation.upsert({
          where: { id: tr.id },
          update: { name: tr.name, slug: tr.slug, description: tr.description ?? null },
          create: {
            id: tr.id,
            categoryId: tr.categoryId,
            languageId: tr.languageId,
            slug: tr.slug,
            name: tr.name,
            description: tr.description ?? null,
          },
        });
      }
    }
    log('postCategories', categories.length);
  }

  // ─── Posts ────────────────────────────────────────────────────
  if (data.posts?.length) {
    for (const p of data.posts) {
      await prisma.post.upsert({
        where: { id: p.id },
        update: {
          type: p.type,
          coverImageId: p.coverImageId ?? null,
          published: p.published,
          isFeatured: p.isFeatured,
          viewCount: p.viewCount ?? 0,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
        },
        create: {
          id: p.id,
          type: p.type,
          authorId: p.authorId ?? null,
          coverImageId: p.coverImageId ?? null,
          published: p.published,
          isFeatured: p.isFeatured,
          viewCount: p.viewCount ?? 0,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      });
    }
    for (const p of data.posts) {
      for (const tr of p.translations ?? []) {
        const translation = await prisma.postTranslation.upsert({
          where: { id: tr.id },
          update: {
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            content: tr.content ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
          create: {
            id: tr.id,
            postId: tr.postId,
            languageId: tr.languageId,
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            content: tr.content ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
        });
        if (tr.blocks?.length) {
          await prisma.postContentBlock.deleteMany({ where: { translationId: translation.id } });
          await prisma.postContentBlock.createMany({
            data: tr.blocks.map((b: any) => ({
              id: b.id,
              translationId: translation.id,
              type: b.type,
              data: b.data,
              sortOrder: b.sortOrder ?? 0,
            })),
          });
        }
      }
      for (const alias of p.slugAliases ?? []) {
        await prisma.postSlugAlias.upsert({
          where: { id: alias.id },
          update: { slug: alias.slug },
          create: {
            id: alias.id,
            postId: alias.postId,
            languageId: alias.languageId,
            slug: alias.slug,
          },
        });
      }
    }
    log('posts', data.posts.length);
  }

  // ─── Many-to-many join tables ─────────────────────────────────
  // PostCategoryPost
  if (data.postCategoryPosts?.length) {
    await prisma.postCategoryPost.createMany({
      data: data.postCategoryPosts.map((r: any) => ({
        postId: r.postId,
        categoryId: r.categoryId,
      })),
      skipDuplicates: true,
    });
    log('postCategoryPosts', data.postCategoryPosts.length);
  }

  // Post <-> Page implicit M2M (_PostPages)
  if (data.postPages?.length) {
    for (const r of data.postPages) {
      await prisma.post
        .update({
          where: { id: r.postId },
          data: { pages: { connect: { id: r.pageId } } },
        })
        .catch(() => {
          /* already connected */
        });
    }
    log('postPages', data.postPages.length);
  }

  // ─── Menus ────────────────────────────────────────────────────
  if (data.menus?.length) {
    for (const m of data.menus) {
      await prisma.menu.upsert({
        where: { id: m.id },
        update: { title: m.title, slug: m.slug, isActive: m.isActive },
        create: { id: m.id, title: m.title, slug: m.slug, isActive: m.isActive ?? true },
      });
      // First pass: create items without parentId
      for (const item of m.items ?? []) {
        await prisma.menuItem.upsert({
          where: { id: item.id },
          update: {
            isActive: item.isActive,
            sortOrder: item.sortOrder,
            type: item.type,
            url: item.url ?? null,
            target: item.target,
            referenceId: item.referenceId ?? null,
          },
          create: {
            id: item.id,
            menuId: item.menuId,
            parentId: null,
            isActive: item.isActive ?? true,
            sortOrder: item.sortOrder ?? 0,
            type: item.type,
            url: item.url ?? null,
            target: item.target ?? '_self',
            referenceId: item.referenceId ?? null,
          },
        });
      }
      // Second pass: wire parentId
      for (const item of m.items ?? []) {
        if (item.parentId) {
          await prisma.menuItem.update({
            where: { id: item.id },
            data: { parentId: item.parentId },
          });
        }
      }
      // Translations
      for (const item of m.items ?? []) {
        for (const tr of item.translations ?? []) {
          await prisma.menuItemTranslation.upsert({
            where: { id: tr.id },
            update: { label: tr.label, slug: tr.slug },
            create: {
              id: tr.id,
              menuItemId: tr.menuItemId,
              languageId: tr.languageId,
              label: tr.label,
              slug: tr.slug,
            },
          });
        }
      }
    }
    log('menus', data.menus.length);
  }

  // ─── Versions ─────────────────────────────────────────────────
  if (data.pageVersions?.length) {
    for (const r of data.pageVersions) {
      await prisma.pageVersion.upsert({
        where: { id: r.id },
        update: { snapshot: r.snapshot },
        create: {
          id: r.id,
          pageId: r.pageId,
          languageId: r.languageId,
          snapshot: r.snapshot,
          createdAt: new Date(r.createdAt),
        },
      });
    }
    log('pageVersions', data.pageVersions.length);
  }

  if (data.postVersions?.length) {
    for (const r of data.postVersions) {
      await prisma.postVersion.upsert({
        where: { id: r.id },
        update: { snapshot: r.snapshot },
        create: {
          id: r.id,
          postId: r.postId,
          languageId: r.languageId,
          snapshot: r.snapshot,
          createdAt: new Date(r.createdAt),
        },
      });
    }
    log('postVersions', data.postVersions.length);
  }

  // ─── Settings ─────────────────────────────────────────────────
  if (data.settings?.length) {
    for (const s of data.settings) {
      await prisma.setting.upsert({
        where: { id: s.id },
        update: {
          key: s.key,
          label: s.label,
          description: s.description ?? null,
          isPublic: s.isPublic,
          isActive: s.isActive,
        },
        create: {
          id: s.id,
          key: s.key,
          label: s.label,
          description: s.description ?? null,
          isPublic: s.isPublic ?? false,
          isActive: s.isActive ?? true,
        },
      });
      if (s.settingGlobalContent) {
        const gc = s.settingGlobalContent;
        await prisma.settingGlobalContent.upsert({
          where: { id: gc.id },
          update: { value: gc.value },
          create: { id: gc.id, settingId: gc.settingId, value: gc.value },
        });
      }
      for (const lc of s.settingLocalizedContent ?? []) {
        await prisma.settingLocalizedContent.upsert({
          where: { id: lc.id },
          update: { value: lc.value },
          create: {
            id: lc.id,
            settingId: lc.settingId,
            languageId: lc.languageId,
            value: lc.value,
          },
        });
      }
    }
    log('settings', data.settings.length);
  }

  // ─── Logs (immutable — insert only, skip duplicates) ──────────
  if (data.auditLogs?.length) {
    await prisma.auditLog.createMany({
      data: data.auditLogs.map((r: any) => ({
        id: r.id,
        actorId: r.actorId ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId ?? null,
        before: r.before ?? null,
        after: r.after ?? null,
        ip: r.ip ?? null,
        createdAt: new Date(r.createdAt),
      })),
      skipDuplicates: true,
    });
    log('auditLogs', data.auditLogs.length);
  }

  if (data.activityLogs?.length) {
    await prisma.activityLog.createMany({
      data: data.activityLogs.map((r: any) => ({
        id: r.id,
        userId: r.userId ?? null,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        description: r.description ?? null,
        ipAddress: r.ipAddress ?? null,
        userAgent: r.userAgent ?? null,
        metadata: r.metadata ?? null,
        createdAt: new Date(r.createdAt),
      })),
      skipDuplicates: true,
    });
    log('activityLogs', data.activityLogs.length);
  }

  // Must run last — after all explicit-ID upserts
  await resetSequences();
}

async function resetSequences() {
  const tables = [
    'languages',
    'permissions',
    'roles',
    'users',
    'block_type_definitions',
    'page_templates',
    'page_template_translations',
    'pages',
    'page_translations',
    'page_content_blocks',
    'page_versions',
    'page_slug_aliases',
    'post_categories',
    'post_category_translations',
    'posts',
    'post_translations',
    'post_content_blocks',
    'post_versions',
    'post_slug_aliases',
    'menus',
    'menu_items',
    'menu_item_translations',
    'media_folders',
    'media',
    'settings',
    'setting_global_contents',
    'setting_localized_contents',
    'notifications',
    'user_notification_states',
    'audit_logs',
    'activity_logs',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
      );
    } catch {
      // table has no serial id — skip
    }
  }
  console.log('  ✅ Sequences reset');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
