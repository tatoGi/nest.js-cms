// prisma/seeds/media-cleanup.ts
// Compares uploads/general files on disk with DB media records.
// Removes DB records whose file no longer exists on disk (in the general folder).
//
// Usage:
//   ts-node prisma/seeds/media-cleanup.ts            # dry-run (safe, default)
//   ts-node prisma/seeds/media-cleanup.ts --execute  # actually delete

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = createPrismaClient();
const DRY_RUN = !process.argv.includes('--execute');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'general')
  : path.join(process.cwd(), 'uploads', 'general');

async function main() {
  console.log(
    DRY_RUN
      ? '🔍 DRY RUN — no changes will be made\n'
      : '⚡ EXECUTE MODE — records will be deleted\n',
  );
  console.log(`📂 Scanning: ${UPLOAD_DIR}\n`);

  // ── 1. Collect filenames on disk ───────────────────────────────
  const diskFiles = new Set<string>();
  if (fs.existsSync(UPLOAD_DIR)) {
    for (const entry of fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
      if (entry.isFile()) diskFiles.add(entry.name);
    }
  }
  console.log(`  Files on disk:   ${diskFiles.size}`);

  // ── 2. Fetch ALL media records ────────────────────────────────
  const allMedia = await prisma.media.findMany({ orderBy: { id: 'asc' } });
  console.log(`  DB records (total): ${allMedia.length}\n`);

  // ── 3. Separate: file exists vs. missing on disk ───────────────
  const present: typeof allMedia = [];
  const missing: typeof allMedia = [];

  for (const record of allMedia) {
    const filename = path.basename(record.filename);
    if (diskFiles.has(filename)) {
      present.push(record);
    } else {
      missing.push(record);
    }
  }

  console.log(`  ✅ Records with file on disk:  ${present.length}`);
  console.log(`  ❌ Records with missing file:  ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('🎉 Nothing to clean up.');
    return;
  }

  // ── 4. Check FK references for each missing-file record ────────
  const missingIds = missing.map((m) => m.id);

  const [pageRefs, postRefs, userRefs] = await Promise.all([
    prisma.page.findMany({
      where: { featureImageId: { in: missingIds } },
      select: { id: true, featureImageId: true },
    }),
    prisma.post.findMany({
      where: { coverImageId: { in: missingIds } },
      select: { id: true, coverImageId: true },
    }),
    prisma.user.findMany({
      where: { avatarMediaId: { in: missingIds } },
      select: { id: true, avatarMediaId: true },
    }),
  ]);

  const referencedIds = new Set<number>([
    ...pageRefs.map((r) => r.featureImageId!),
    ...postRefs.map((r) => r.coverImageId!),
    ...userRefs.map((r) => r.avatarMediaId!),
  ]);

  const safeToDelete = missing.filter((m) => !referencedIds.has(m.id));
  const referenced = missing.filter((m) => referencedIds.has(m.id));

  // ── 5. Report ─────────────────────────────────────────────────
  if (referenced.length > 0) {
    console.log(
      `⚠️  ${referenced.length} record(s) are missing on disk but still REFERENCED — skipping:\n`,
    );
    for (const m of referenced) {
      const refs: string[] = [];
      if (pageRefs.some((r) => r.featureImageId === m.id)) refs.push('page.featureImage');
      if (postRefs.some((r) => r.coverImageId === m.id)) refs.push('post.coverImage');
      if (userRefs.some((r) => r.avatarMediaId === m.id)) refs.push('user.avatar');
      console.log(`  ID ${m.id}  ${m.filename}  ← used by: ${refs.join(', ')}`);
    }
    console.log();
  }

  console.log(`🗑️  ${safeToDelete.length} record(s) safe to delete:\n`);
  for (const m of safeToDelete) {
    console.log(`  ID ${m.id}  ${m.filename}`);
  }
  console.log();

  if (safeToDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // ── 6. Delete ─────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('ℹ️  Dry run — run with --execute to delete these records.');
    return;
  }

  const deleteIds = safeToDelete.map((m) => m.id);
  const { count } = await prisma.media.deleteMany({ where: { id: { in: deleteIds } } });
  console.log(`✅ Deleted ${count} media record(s).`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
