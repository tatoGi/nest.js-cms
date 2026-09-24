// prisma/seeds/db-truncate.ts
// Deletes all rows from every table in FK-safe order.
// Schema (tables, indexes, sequences) is left intact.
//
// Usage:
//   ts-node prisma/seeds/db-truncate.ts            # dry-run
//   ts-node prisma/seeds/db-truncate.ts --execute  # actually truncate

import { createPrismaClient } from './prisma-client';

const prisma = createPrismaClient();
const DRY_RUN = !process.argv.includes('--execute');

// Deletion order respects FK constraints — children before parents.
// Implicit M2M table _PostPages is handled via Prisma disconnect (no direct model).
const TRUNCATE_ORDER = [
  // Logs (no FK dependents)
  'audit_logs',
  'activity_logs',

  // Chat
  'operator_messages',
  'operator_threads',
  'chat_messages',
  'chat_sessions',
  'chat_tags',
  'canned_responses',

  // Notifications
  'user_notification_states',
  'notifications',

  // Settings
  'setting_localized_contents',
  'setting_global_contents',
  'settings',

  // Versions
  'page_versions',
  'post_versions',

  // Content blocks
  'page_content_blocks',
  'post_content_blocks',

  // Translations
  'page_translations',
  'post_translations',
  'page_template_translations',
  'post_category_translations',
  'menu_item_translations',

  // Slug aliases
  'page_slug_aliases',
  'post_slug_aliases',

  // Explicit M2M join tables
  'post_category_posts',
  'user_permissions',
  'user_roles',
  'role_permissions',

  // Main content
  'menu_items',
  'menus',
  'post_categories',
  'posts', // _PostPages implicit M2M is cascade-deleted here
  'pages',
  'page_templates',
  'block_type_definitions',

  // Media
  'media',
  'media_folders',

  // Auth
  'permissions',
  'roles',
  'users',

  // Foundation
  'languages',
  'cache',
];

async function main() {
  console.log(
    DRY_RUN
      ? '🔍 DRY RUN — no changes will be made\n'
      : '⚡ EXECUTE MODE — all rows will be deleted\n',
  );

  if (DRY_RUN) {
    console.log('Tables that would be truncated (in order):');
    TRUNCATE_ORDER.forEach((t) => console.log(`  ${t}`));
    console.log('\nRun with --execute to proceed.');
    return;
  }

  console.log('🗑️  Truncating tables...\n');

  for (const table of TRUNCATE_ORDER) {
    try {
      const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      console.log(`  ✅ ${table}: ${result} rows deleted`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ⚠️  ${table}: ${msg}`);
    }
  }

  // Reset all sequences so IDs start from 1 again
  console.log('\n🔄 Resetting sequences...');
  for (const table of TRUNCATE_ORDER) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 1, false)`,
      );
    } catch {
      // table has no serial id (composite PK or cuid) — skip
    }
  }

  console.log('\n✅ Database cleaned. Run `npm run prisma:seed` to restore data.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
