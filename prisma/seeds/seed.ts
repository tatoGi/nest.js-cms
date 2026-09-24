// prisma/seeds/seed.ts
// Runs all seeders in dependency order.
// Usage: npm run prisma:seed

import { createPrismaClient } from './prisma-client';
import { execSync } from 'child_process';

const prisma = createPrismaClient();

// Sub-seeders run through the seeds tsconfig (see ./tsconfig.json), not
// whatever the app's root tsconfig happens to be — these are spawned as fresh
// ts-node processes, so they don't inherit this one's compiler options.
// Defined once here rather than repeated per call, so the four invocations
// below can't drift apart.
const SEED_RUNNER = 'ts-node -P prisma/seeds/tsconfig.json';

function runSeeder(script: string): void {
  execSync(`${SEED_RUNNER} prisma/seeds/${script}`, { stdio: 'inherit' });
}

async function main() {
  console.log('🚀 Starting seeding...\n');

  try {
    // 1. Core content from seed_data.json
    //    (languages, permissions, roles, users, page templates, pages,
    //     post categories, posts, menus, settings, versions, logs, M2M tables)
    console.log('📦 [1/2] Restoring core content from seed_data.json...');
    runSeeder('seed-json-data.ts');

    // 2. Media — scan uploads/ folder and create DB records for files on disk
    console.log('\n📦 [2/2] Importing media from disk...');
    runSeeder('seed-media-import.ts');

    // No chat seeding happens here — not roles/permissions (seed-chat.ts) and
    // not config (seed-chat-data.ts). Both are run explicitly instead:
    //   npm run prisma:seed:chat      roles + permissions (production-safe)
    //   npm run prisma:seed:chat:dev  config + demo accounts (dev only)
    // Note this means a fresh deployment has no Operator/Chat Supervisor role
    // until `prisma:seed:chat` is run, so chat access can't be granted to
    // anyone before that.

    console.log('\n✨ All seeders completed.\n');
    await printSummary();
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function printSummary() {
  const [
    languages,
    permissions,
    roles,
    rolePermissions,
    users,
    userRoles,
    userPermissions,
    blockTypes,
    pageTemplates,
    pages,
    postCategories,
    posts,
    postCategoryPosts,
    menus,
    menuItems,
    mediaFolders,
    media,
    settings,
    notifications,
    cannedResponses,
    chatSessions,
    chatMessages,
    operatorThreads,
    operatorMessages,
  ] = await Promise.all([
    prisma.language.count(),
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.user.count(),
    prisma.userRole.count(),
    prisma.userPermission.count(),
    prisma.blockTypeDefinition.count(),
    prisma.pageTemplate.count(),
    prisma.page.count(),
    prisma.postCategory.count(),
    prisma.post.count(),
    prisma.postCategoryPost.count(),
    prisma.menu.count(),
    prisma.menuItem.count(),
    prisma.mediaFolder.count(),
    prisma.media.count(),
    prisma.setting.count(),
    prisma.notification.count(),
    prisma.cannedResponse.count(),
    prisma.chatSession.count(),
    prisma.chatMessage.count(),
    prisma.operatorThread.count(),
    prisma.operatorMessage.count(),
  ]);

  console.log('📊 Summary:');
  console.log(`  Languages:          ${languages}`);
  console.log(`  Permissions:        ${permissions}`);
  console.log(`  Roles:              ${roles}`);
  console.log(`  Role→Permission:    ${rolePermissions}`);
  console.log(`  Users:              ${users}`);
  console.log(`  User→Role:          ${userRoles}`);
  console.log(`  User→Permission:    ${userPermissions}`);
  console.log(`  Block Types:        ${blockTypes}`);
  console.log(`  Page Templates:     ${pageTemplates}`);
  console.log(`  Pages:              ${pages}`);
  console.log(`  Post Categories:    ${postCategories}`);
  console.log(`  Posts:              ${posts}`);
  console.log(`  Post→Category:      ${postCategoryPosts}`);
  console.log(`  Menus:              ${menus}`);
  console.log(`  Menu Items:         ${menuItems}`);
  console.log(`  Media Folders:      ${mediaFolders}`);
  console.log(`  Media:              ${media}`);
  console.log(`  Settings:           ${settings}`);
  console.log(`  Notifications:      ${notifications}`);
  console.log(`  Canned Responses:   ${cannedResponses}`);
  console.log(`  Chat Sessions:      ${chatSessions}`);
  console.log(`  Chat Messages:      ${chatMessages}`);
  console.log(`  Operator Threads:   ${operatorThreads}`);
  console.log(`  Operator Messages:  ${operatorMessages}`);
}

main();
