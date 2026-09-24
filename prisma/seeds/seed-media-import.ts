// prisma/seeds/seed-media-import.ts
// Scans the uploads/ folder and creates DB records for any files
// that exist on disk but have no corresponding media record.

import { createPrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = createPrismaClient();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const URL_PREFIX = process.env.UPLOAD_URL_PREFIX || '/uploads';

// Extension → MIME type map
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Recursively collect all files under a directory.
 * Returns paths relative to UPLOAD_DIR.
 */
function collectFiles(dir: string, base: string = ''): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

async function seedMediaImport() {
  console.log('🔍 Scanning uploads folder:', UPLOAD_DIR);

  const files = collectFiles(UPLOAD_DIR);

  if (files.length === 0) {
    console.log('⚠️  No files found in uploads folder.');
    return;
  }

  console.log(`📁 Found ${files.length} file(s) on disk.\n`);

  // Fetch all existing URLs from DB to skip already-imported files
  const existing = await prisma.media.findMany({ select: { url: true } });
  const existingUrls = new Set(existing.map((m) => m.url));

  let created = 0;
  let skipped = 0;

  for (const relativePath of files) {
    const url = `${URL_PREFIX}/${relativePath}`;

    if (existingUrls.has(url)) {
      skipped++;
      continue;
    }

    const absolutePath = path.join(UPLOAD_DIR, relativePath);
    const stat = fs.statSync(absolutePath);
    const filename = path.basename(relativePath);
    const mimeType = getMimeType(filename);

    // Derive folder from path segments: uploads/2026/general/file.jpg → folder = "general"
    const parts = relativePath.split('/');
    const folder =
      parts.length >= 3 ? parts[parts.length - 2] : parts.length >= 2 ? parts[0] : 'general';

    await prisma.media.create({
      data: {
        filename,
        originalName: filename,
        path: relativePath,
        url,
        mimeType,
        size: stat.size,
        legacyFolder: folder,
        scope: 'cms',
        tags: [],
      },
    });

    console.log(`  ✅ Imported: ${relativePath}`);
    created++;
  }

  console.log(`\n📊 Done — ${created} imported, ${skipped} already in DB.`);
}

async function main() {
  try {
    await seedMediaImport();
  } catch (error) {
    console.error('❌ Error importing media:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
