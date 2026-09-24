// prisma/seeds/seed-chat-dev-users.ts
// Dev-only: creates demo operator/supervisor login accounts with hardcoded
// passwords, for local testing of the chat module. NEVER run against
// production — see assertNotProduction below.
// Requires seed-chat.ts to have already run (Operator/Chat Supervisor roles
// must exist).
// Safe to re-run — uses upsert throughout.

import { createPrismaClient } from './prisma-client';
import * as bcrypt from 'bcrypt';
import { assertNotProduction } from './assert-not-production';

const prisma = createPrismaClient();

const OPERATOR_USERS = [
  {
    firstName: 'Operator',
    lastName: 'One',
    email: 'operator@admin.ge',
    password: 'Operator@123',
    roleSlug: 'operator',
  },
  {
    firstName: 'Operator',
    lastName: 'Two',
    email: 'operator2@admin.ge',
    password: 'Operator@2',
    roleSlug: 'operator',
  },
  {
    firstName: 'Operator',
    lastName: 'Three',
    email: 'operator3@admin.ge',
    password: 'Operator@3',
    roleSlug: 'operator',
  },
  {
    firstName: 'Supervisor',
    lastName: '',
    email: 'supervisor@admin.ge',
    password: 'Supervisor@1',
    roleSlug: 'chat-supervisor',
  },
];

async function main() {
  assertNotProduction('seed-chat-dev-users.ts');
  console.log('🌱 Seeding dev-only chat demo users...\n');

  const operatorRole = await prisma.role.findUnique({ where: { slug: 'operator' } });
  const supervisorRole = await prisma.role.findUnique({ where: { slug: 'chat-supervisor' } });
  if (!operatorRole || !supervisorRole) {
    console.error('❌ Operator/Chat Supervisor roles not found. Run seed-chat.ts first.');
    process.exit(1);
  }

  const roleMap: Record<string, number> = {
    operator: operatorRole.id,
    'chat-supervisor': supervisorRole.id,
  };

  for (const u of OPERATOR_USERS) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        password: hashed,
        isActive: true,
      },
    });
    console.log(`  ✅ User: ${user.email} (id=${user.id})`);

    const roleId = roleMap[u.roleSlug];
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    console.log(`  ✅ UserRole: ${user.email} → ${u.roleSlug}`);
  }

  console.log('\n✨ Dev chat users seeded.\n');
  console.log('  Logins:');
  console.log('    operator@admin.ge   / Operator@123   (operator)');
  console.log('    operator2@admin.ge  / Operator@2     (operator)');
  console.log('    operator3@admin.ge  / Operator@3     (operator)');
  console.log('    supervisor@admin.ge / Supervisor@1   (chat-supervisor)');
  console.log('\n  Run seed-chat-demo.ts next to add demo visitor sessions + chat tags.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
