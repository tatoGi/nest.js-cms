// prisma/seeds/seed-chat-data.ts
// Dev-only: restores chat CONFIG from seed_data.json — canned responses and
// their categories, automatic-message defaults (canned responses with a
// trigger set), the reporting taxonomy (programs/regions), and the
// ChatConfig singleton.
//
// Dev-only because seed_data.json is a snapshot of somebody's local database:
// replaying it over production would overwrite supervisor-tuned settings and
// live canned-response content with whatever happened to be on a dev machine
// when the export ran. Chat ROLES and PERMISSIONS are a different matter and
// remain production-safe — see seed-chat.ts, which is still part of
// `npm run prisma:seed`.
//
// Creates no user accounts, sessions, or messages — see seed-chat-dev-data.ts.
// Safe to re-run — uses upsert throughout.
// Usage: npm run prisma:seed:chat:data (or as part of prisma:seed:chat:dev)

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';
import { assertNotProduction } from './assert-not-production';

const prisma = createPrismaClient();
const DATA_FILE = path.join(__dirname, 'seed_data.json');

async function main() {
  assertNotProduction('seed-chat-data.ts');

  if (!fs.existsSync(DATA_FILE)) {
    console.warn(`⚠️  seed_data.json not found at ${DATA_FILE} — skipping.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const log = (label: string, count: number) => console.log(`  ✅ ${label}: ${count} rows`);

  // ─── Canned Response Categories ───────────────────────────────
  // Restored before the responses below, which carry a categoryId FK.
  if (data.cannedResponseCategories?.length) {
    for (const c of data.cannedResponseCategories) {
      await prisma.cannedResponseCategory.upsert({
        where: { id: c.id },
        update: { name: c.name, sortOrder: c.sortOrder ?? 0 },
        create: {
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder ?? 0,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        },
      });
    }
    log('cannedResponseCategories', data.cannedResponseCategories.length);
  }

  // ─── Canned Responses ─────────────────────────────────────────
  if (data.cannedResponses?.length) {
    for (const r of data.cannedResponses) {
      await prisma.cannedResponse.upsert({
        where: { id: r.id },
        update: {
          title: r.title,
          body: r.body,
          trigger: r.trigger ?? null,
          delaySeconds: r.delaySeconds ?? null,
          isEnabled: r.isEnabled ?? true,
          categoryId: r.categoryId ?? null,
        },
        create: {
          id: r.id,
          title: r.title,
          body: r.body,
          trigger: r.trigger ?? null,
          delaySeconds: r.delaySeconds ?? null,
          isEnabled: r.isEnabled ?? true,
          // Was previously dropped on import, so every restored response
          // came back uncategorised even when the category existed.
          categoryId: r.categoryId ?? null,
          createdById: r.createdById,
          createdAt: new Date(r.createdAt),
        },
      });
    }
    log('cannedResponses', data.cannedResponses.length);
  }

  // ─── Canned Response Translations (per-language automatic messages) ──
  if (data.cannedResponseTranslations?.length) {
    for (const t of data.cannedResponseTranslations) {
      await prisma.cannedResponseTranslation.upsert({
        where: {
          cannedResponseId_languageId: {
            cannedResponseId: t.cannedResponseId,
            languageId: t.languageId,
          },
        },
        update: { body: t.body },
        create: {
          cannedResponseId: t.cannedResponseId,
          languageId: t.languageId,
          body: t.body,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        },
      });
    }
    log('cannedResponseTranslations', data.cannedResponseTranslations.length);
  }

  // ─── Programs (chat reporting taxonomy) ────────────────────────
  if (data.programs?.length) {
    for (const p of data.programs) {
      await prisma.program.upsert({
        where: { id: p.id },
        update: { name: p.name, isActive: p.isActive },
        create: {
          id: p.id,
          name: p.name,
          isActive: p.isActive,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      });
    }
    log('programs', data.programs.length);
  }

  // ─── Regions (the other half of the reporting taxonomy) ────────
  if (data.regions?.length) {
    for (const r of data.regions) {
      await prisma.region.upsert({
        where: { id: r.id },
        update: { name: r.name, isActive: r.isActive },
        create: {
          id: r.id,
          name: r.name,
          isActive: r.isActive,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
      });
    }
    log('regions', data.regions.length);
  }

  // ─── Chat config (singleton, id 1) ─────────────────────────────
  // maxActiveChats plus every notification sound/volume/duration/pitch knob.
  // Spread rather than field-by-field so a newly added column in ChatConfig
  // is carried over automatically instead of being silently dropped until
  // someone remembers to update this block.
  if (data.chatConfig?.length) {
    for (const c of data.chatConfig) {
      const { id, updatedAt, ...settings } = c;
      await prisma.chatConfig.upsert({
        where: { id },
        update: settings,
        create: { id, ...settings, updatedAt: new Date(updatedAt) },
      });
    }
    log('chatConfig', data.chatConfig.length);
  }

  console.log('\n  For local/dev testing, run: npm run prisma:seed:chat:dev');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
