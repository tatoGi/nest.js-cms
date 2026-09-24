// prisma/seeds/seed-chat-dev-data.ts
// Dev-only: restores demo notifications, chat sessions/messages, and
// operator DM threads/messages from seed_data.json. NEVER run against
// production — see assertNotProduction below.
// Safe to re-run — uses upsert throughout.
// Usage: ts-node prisma/seeds/seed-chat-dev-data.ts

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';
import { assertNotProduction } from './assert-not-production';

const prisma = createPrismaClient();
const DATA_FILE = path.join(__dirname, 'seed_data.json');

async function main() {
  assertNotProduction('seed-chat-dev-data.ts');

  if (!fs.existsSync(DATA_FILE)) {
    console.warn(`⚠️  seed_data.json not found at ${DATA_FILE} — skipping.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const log = (label: string, count: number) => console.log(`  ✅ ${label}: ${count} rows`);

  // ─── Notifications ────────────────────────────────────────────
  if (data.notifications?.length) {
    for (const n of data.notifications) {
      await prisma.notification.upsert({
        where: { id: n.id },
        update: {
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link ?? null,
          actorId: n.actorId ?? null,
        },
        create: {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link ?? null,
          actorId: n.actorId ?? null,
          createdAt: new Date(n.createdAt),
        },
      });
    }
    log('notifications', data.notifications.length);
  }

  if (data.userNotificationStates?.length) {
    for (const s of data.userNotificationStates) {
      await prisma.userNotificationState.upsert({
        where: { userId: s.userId },
        update: { lastReadAt: new Date(s.lastReadAt) },
        create: { id: s.id, userId: s.userId, lastReadAt: new Date(s.lastReadAt) },
      });
    }
    log('userNotificationStates', data.userNotificationStates.length);
  }

  // ─── Chat Sessions + Messages ─────────────────────────────────
  if (data.chatSessions?.length) {
    for (const s of data.chatSessions) {
      await prisma.chatSession.upsert({
        where: { id: s.id },
        update: {
          visitorName: s.visitorName ?? null,
          visitorEmail: s.visitorEmail ?? null,
          visitorPhone: s.visitorPhone ?? null,
          visitorLanguage: s.visitorLanguage ?? null,
          operatorId: s.operatorId ?? null,
          knownUserId: s.knownUserId ?? null,
          status: s.status,
          closedAt: s.closedAt ? new Date(s.closedAt) : null,
          visitorBrowser: s.visitorBrowser ?? null,
          visitorIp: s.visitorIp ?? null,
          visitorPage: s.visitorPage ?? null,
          resolutionTag: s.resolutionTag ?? null,
          closureSummary: s.closureSummary ?? null,
          closedByOperatorId: s.closedByOperatorId ?? null,
          visitorRating: s.visitorRating ?? null,
          regionId: s.regionId ?? null,
          programId: s.programId ?? null,
        },
        create: {
          id: s.id,
          visitorName: s.visitorName ?? null,
          visitorEmail: s.visitorEmail ?? null,
          visitorPhone: s.visitorPhone ?? null,
          visitorLanguage: s.visitorLanguage ?? null,
          operatorId: s.operatorId ?? null,
          knownUserId: s.knownUserId ?? null,
          status: s.status,
          startedAt: new Date(s.startedAt),
          closedAt: s.closedAt ? new Date(s.closedAt) : null,
          visitorBrowser: s.visitorBrowser ?? null,
          visitorIp: s.visitorIp ?? null,
          visitorPage: s.visitorPage ?? null,
          resolutionTag: s.resolutionTag ?? null,
          closureSummary: s.closureSummary ?? null,
          closedByOperatorId: s.closedByOperatorId ?? null,
          visitorRating: s.visitorRating ?? null,
          regionId: s.regionId ?? null,
          programId: s.programId ?? null,
        },
      });
      for (const msg of s.messages ?? []) {
        await prisma.chatMessage.upsert({
          where: { id: msg.id },
          update: { body: msg.body, isInternal: msg.isInternal },
          create: {
            id: msg.id,
            sessionId: msg.sessionId,
            authorId: msg.authorId ?? null,
            role: msg.role,
            body: msg.body,
            isInternal: msg.isInternal ?? false,
            createdAt: new Date(msg.createdAt),
          },
        });
      }
    }
    log('chatSessions', data.chatSessions.length);
  }

  // ─── Operator Threads + Messages ──────────────────────────────
  if (data.operatorThreads?.length) {
    for (const t of data.operatorThreads) {
      await prisma.operatorThread.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          participant1Id: t.participant1Id,
          participant2Id: t.participant2Id,
          createdAt: new Date(t.createdAt),
        },
      });
      for (const msg of t.messages ?? []) {
        await prisma.operatorMessage.upsert({
          where: { id: msg.id },
          update: { body: msg.body },
          create: {
            id: msg.id,
            threadId: msg.threadId,
            authorId: msg.authorId,
            body: msg.body,
            createdAt: new Date(msg.createdAt),
          },
        });
      }
    }
    log('operatorThreads', data.operatorThreads.length);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
