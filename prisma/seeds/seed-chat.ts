// prisma/seeds/seed-chat.ts
// Seeds chat permissions + Operator/Chat Supervisor roles.
// Safe to re-run — uses upsert throughout. Production-safe: creates no user
// accounts or demo content — see seed-chat-dev-users.ts for that.

import { createPrismaClient } from './prisma-client';

const prisma = createPrismaClient();

const CHAT_PERMISSIONS = [
  { key: 'chat.view', label: 'View Chat Sessions', group: 'chat' },
  { key: 'chat.reply', label: 'Reply in Chat', group: 'chat' },
  { key: 'chat.join', label: 'Join Any Chat Session', group: 'chat' },
  { key: 'chat.close', label: 'Close & Manage Chat Sessions', group: 'chat' },
  // chat.manage was split into these four granular permissions and fully
  // removed (no code references it, no role/user grants existed) — see
  // git history if you need the old single-permission shape.
  { key: 'chat.manage_operators', label: 'Manage Chat Operators', group: 'chat' },
  { key: 'chat.manage_analytics', label: 'View Chat Analytics', group: 'chat' },
  { key: 'chat.manage_automation', label: 'Manage Automatic Messages', group: 'chat' },
  { key: 'chat.manage_config', label: 'Manage Chat Configuration', group: 'chat' },
  { key: 'chat.manage_programs', label: 'Manage Chat Reporting Programs', group: 'chat' },
  { key: 'chat.manage_regions', label: 'Manage Chat Reporting Regions', group: 'chat' },
  {
    key: 'chat.delete_sessions',
    label: 'Trash / Restore / Permanently Delete Chat Sessions',
    group: 'chat',
  },
  {
    key: 'chat.manage_canned_responses',
    label: 'Manage Canned Response Categories & Texts',
    group: 'chat',
  },
];

// Generic — grants access to the shared ManagedUsersController. Which
// role(s) the grantee may actually CRUD is resolved from RoleManagement
// rows below, not from this permission itself.
const SCOPED_USER_MANAGEMENT_PERMISSION = {
  key: 'users.manage_scoped',
  label: 'Manage Users in a Role You Supervise',
  group: 'users',
};

const OPERATOR_ROLE = {
  name: 'Operator',
  slug: 'operator',
  description: 'Chat support operator — view + reply to own sessions',
};

const SUPERVISOR_ROLE = {
  name: 'Chat Supervisor',
  slug: 'chat-supervisor',
  description: 'Can join any session, close, reassign, and manage tags',
};

const OPERATOR_PERMISSIONS = ['chat.view', 'chat.reply'];
const SUPERVISOR_PERMISSIONS = [
  'chat.view',
  'chat.reply',
  'chat.join',
  'chat.close',
  'chat.manage_operators',
  'chat.manage_analytics',
  'chat.manage_automation',
  'chat.manage_config',
  'chat.manage_programs',
  'chat.manage_regions',
  'chat.delete_sessions',
  'chat.manage_canned_responses',
  'users.manage_scoped',
  // Read-only — needed so the canned-response/auto-message translation UI
  // can look up active languages and which one is default.
  'languages.view',
];

async function main() {
  console.log('🌱 Seeding chat permissions, roles, operators, and visitors...\n');

  // ── Permissions ──────────────────────────────────────────────────
  for (const perm of [...CHAT_PERMISSIONS, SCOPED_USER_MANAGEMENT_PERMISSION]) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label, group: perm.group },
      create: perm,
    });
    console.log(`  ✅ Permission: ${perm.key}`);
  }

  const allChatPerms = await prisma.permission.findMany({
    where: {
      key: {
        in: [
          ...CHAT_PERMISSIONS.map((p) => p.key),
          SCOPED_USER_MANAGEMENT_PERMISSION.key,
          'languages.view',
        ],
      },
    },
  });
  const permByKey = Object.fromEntries(allChatPerms.map((p) => [p.key, p]));

  // ── Operator role ─────────────────────────────────────────────────
  const operatorRole = await prisma.role.upsert({
    where: { slug: OPERATOR_ROLE.slug },
    update: { name: OPERATOR_ROLE.name, description: OPERATOR_ROLE.description },
    create: OPERATOR_ROLE,
  });
  console.log(`  ✅ Role: ${operatorRole.slug}`);

  for (const key of OPERATOR_PERMISSIONS) {
    const perm = permByKey[key];
    if (!perm) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operatorRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: operatorRole.id, permissionId: perm.id },
    });
    console.log(`  ✅ RolePermission: operator → ${key}`);
  }

  // ── Supervisor role ───────────────────────────────────────────────
  const supervisorRole = await prisma.role.upsert({
    where: { slug: SUPERVISOR_ROLE.slug },
    update: { name: SUPERVISOR_ROLE.name, description: SUPERVISOR_ROLE.description },
    create: SUPERVISOR_ROLE,
  });
  console.log(`  ✅ Role: ${supervisorRole.slug}`);

  for (const key of SUPERVISOR_PERMISSIONS) {
    const perm = permByKey[key];
    if (!perm) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: supervisorRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: supervisorRole.id, permissionId: perm.id },
    });
    console.log(`  ✅ RolePermission: chat-supervisor → ${key}`);
  }

  // ── Admin role ──────────────────────────────────────────────────
  // The Admin role ("Full system access with all permissions" per its own
  // description) predates the chat module — its RolePermission grants in
  // seed_data.json were never updated when chat.* was introduced, so admins
  // couldn't see chat management screens (or their Trash tabs) at all. Grant
  // every chat permission + users.manage_scoped here so Admin stays "full
  // access" as new chat permissions are added, without hardcoding an
  // Admin-only bypass into the permission-checking logic itself.
  const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
  if (adminRole) {
    for (const key of SUPERVISOR_PERMISSIONS) {
      const perm = permByKey[key];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
      console.log(`  ✅ RolePermission: admin → ${key}`);
    }
  }

  // One-time cleanup: chat.manage was split into the four chat.manage_*
  // permissions above and is no longer referenced anywhere. Delete the row
  // outright (cascades to any leftover RolePermission/UserPermission) so any
  // DB seeded before this split gets fully cleaned up, not just this run's.
  const deletedLegacyManage = await prisma.permission.deleteMany({
    where: { key: 'chat.manage' },
  });
  if (deletedLegacyManage.count > 0) {
    console.log('  🗑️  Permission: chat.manage (retired, deleted)');
  }

  // ── Role management (who can CRUD whose accounts) ─────────────────
  await prisma.roleManagement.upsert({
    where: {
      managerRoleSlug_managedRoleSlug: {
        managerRoleSlug: supervisorRole.slug,
        managedRoleSlug: operatorRole.slug,
      },
    },
    update: {},
    create: {
      managerRoleSlug: supervisorRole.slug,
      managedRoleSlug: operatorRole.slug,
    },
  });
  console.log(`  ✅ RoleManagement: ${supervisorRole.slug} → ${operatorRole.slug}`);

  console.log('\n✨ Chat seed complete.\n');
  console.log(
    '  Permissions: chat.view, chat.reply, chat.join, chat.close, chat.manage_operators, chat.manage_analytics, chat.manage_automation, chat.manage_config, chat.manage_programs, chat.manage_regions, chat.delete_sessions, chat.manage_canned_responses',
  );
  console.log(
    '  Roles: operator (view+reply) | chat-supervisor (view+reply+join+close+manage_operators+manage_analytics+manage_automation+manage_config+manage_programs+manage_regions+delete_sessions+manage_canned_responses)',
  );
  console.log('\n  No user accounts or demo content created by this script (production-safe).');
  console.log('  For local/dev testing, run: npm run prisma:seed:chat:dev');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
