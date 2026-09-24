// prisma/seeds/export-to-json.ts
// Exports all restorable data to seed_data.json.
// Usage: ts-node prisma/seeds/export-to-json.ts

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = createPrismaClient();

async function main() {
  console.log('🚀 Exporting database to seed_data.json...\n');

  const data: Record<string, unknown> = {};

  const dump = async (key: string, fetcher: () => Promise<unknown>) => {
    try {
      const result = await fetcher();
      data[key] = result;
      const count = Array.isArray(result) ? result.length : 1;
      console.log(`  ✅ ${key}: ${count} rows`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ⚠️  Skipped ${key}: ${msg}`);
    }
  };

  // ─── Foundation ───────────────────────────────────────────────
  await dump('languages', () => prisma.language.findMany({ orderBy: { id: 'asc' } }));

  await dump('permissions', () => prisma.permission.findMany({ orderBy: { id: 'asc' } }));

  await dump('roles', () => prisma.role.findMany({ orderBy: { id: 'asc' } }));

  await dump('rolePermissions', () =>
    prisma.rolePermission.findMany({ orderBy: { roleId: 'asc' } }),
  );

  await dump('roleManagement', () => prisma.roleManagement.findMany({ orderBy: { id: 'asc' } }));

  // refreshToken intentionally omitted
  await dump('users', () =>
    prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        password: true,
        avatarMediaId: true,
        isActive: true,
        lastLogin: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  );

  await dump('userRoles', () => prisma.userRole.findMany({ orderBy: { userId: 'asc' } }));

  await dump('userPermissions', () =>
    prisma.userPermission.findMany({ orderBy: { userId: 'asc' } }),
  );

  // ─── Block Type Definitions ───────────────────────────────────
  await dump('blockTypeDefinitions', () =>
    prisma.blockTypeDefinition.findMany({ orderBy: { sortOrder: 'asc' } }),
  );

  // ─── Media ────────────────────────────────────────────────────
  await dump('mediaFolders', () => prisma.mediaFolder.findMany({ orderBy: { id: 'asc' } }));

  // Media file records — actual files are re-imported by seed-media-import.ts
  await dump('media', () => prisma.media.findMany({ orderBy: { id: 'asc' } }));

  // ─── Page Templates ───────────────────────────────────────────
  await dump('pageTemplates', () =>
    prisma.pageTemplate.findMany({
      orderBy: { id: 'asc' },
      include: { translations: { orderBy: { languageId: 'asc' } } },
    }),
  );

  // ─── Pages ────────────────────────────────────────────────────
  await dump('pages', () =>
    prisma.page.findMany({
      orderBy: { id: 'asc' },
      include: {
        translations: {
          orderBy: { languageId: 'asc' },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        },
        slugAliases: { orderBy: { id: 'asc' } },
      },
    }),
  );

  await dump('pageVersions', () => prisma.pageVersion.findMany({ orderBy: { id: 'asc' } }));

  // ─── Post Categories ──────────────────────────────────────────
  await dump('postCategories', () =>
    prisma.postCategory.findMany({
      orderBy: { id: 'asc' },
      include: { translations: { orderBy: { languageId: 'asc' } } },
    }),
  );

  // ─── Posts ────────────────────────────────────────────────────
  await dump('posts', () =>
    prisma.post.findMany({
      orderBy: { id: 'asc' },
      include: {
        translations: {
          orderBy: { languageId: 'asc' },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        },
        slugAliases: { orderBy: { id: 'asc' } },
      },
    }),
  );

  // ─── Many-to-many join tables ─────────────────────────────────
  // PostCategoryPost — explicit join model (has createdAt)
  await dump('postCategoryPosts', () =>
    prisma.postCategoryPost.findMany({ orderBy: [{ postId: 'asc' }, { categoryId: 'asc' }] }),
  );

  // Post <-> Page implicit M2M (_PostPages) — Prisma names columns A=pageId, B=postId
  await dump(
    'postPages',
    () =>
      prisma.$queryRaw<{ postId: number; pageId: number }[]>`
      SELECT "B" AS "postId", "A" AS "pageId" FROM "_PostPages" ORDER BY "B", "A"
    `,
  );

  await dump('postVersions', () => prisma.postVersion.findMany({ orderBy: { id: 'asc' } }));

  // ─── Menus ────────────────────────────────────────────────────
  await dump('menus', () =>
    prisma.menu.findMany({
      orderBy: { id: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { translations: { orderBy: { languageId: 'asc' } } },
        },
      },
    }),
  );

  // ─── Settings ─────────────────────────────────────────────────
  await dump('settings', () =>
    prisma.setting.findMany({
      orderBy: { id: 'asc' },
      include: {
        settingGlobalContent: true,
        settingLocalizedContent: { orderBy: { languageId: 'asc' } },
      },
    }),
  );

  // ─── Notifications ────────────────────────────────────────────
  await dump('notifications', () => prisma.notification.findMany({ orderBy: { id: 'asc' } }));

  await dump('userNotificationStates', () =>
    prisma.userNotificationState.findMany({ orderBy: { userId: 'asc' } }),
  );

  // ─── Chat ─────────────────────────────────────────────────────
  // Categories come before the responses that reference them, so the JSON
  // reads in the same order the importer has to apply it (CannedResponse
  // .categoryId is a FK — restoring responses first would dangle).
  await dump('cannedResponseCategories', () =>
    prisma.cannedResponseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  );

  await dump('cannedResponses', () =>
    prisma.cannedResponse.findMany({ orderBy: { createdAt: 'asc' } }),
  );

  await dump('cannedResponseTranslations', () =>
    prisma.cannedResponseTranslation.findMany({ orderBy: { id: 'asc' } }),
  );

  await dump('programs', () => prisma.program.findMany({ orderBy: { name: 'asc' } }));

  // Region is the other half of the chat reporting taxonomy (ChatSession
  // .regionId), and was the only one of the pair missing here.
  await dump('regions', () => prisma.region.findMany({ orderBy: { name: 'asc' } }));

  // Singleton row (id 1) holding the supervisor-tuned chat knobs —
  // maxActiveChats plus every notification sound/volume/duration setting for
  // operators and visitors. Without this, a reset silently reverts all of
  // them to schema defaults.
  await dump('chatConfig', () => prisma.chatConfig.findMany({ orderBy: { id: 'asc' } }));

  await dump('chatSessions', () =>
    prisma.chatSession.findMany({
      orderBy: { startedAt: 'asc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    }),
  );

  await dump('operatorThreads', () =>
    prisma.operatorThread.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    }),
  );

  // ─── Logs ─────────────────────────────────────────────────────
  await dump('auditLogs', () => prisma.auditLog.findMany({ orderBy: { id: 'asc' } }));

  await dump('activityLogs', () => prisma.activityLog.findMany({ orderBy: { id: 'asc' } }));

  // ─── Write output ─────────────────────────────────────────────
  const outputPath = path.join(__dirname, 'seed_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  const sizeKb = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`\n✅ Exported to ${outputPath} (${sizeKb} KB)`);
}

main()
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
