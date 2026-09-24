// prisma/seeds/prisma-client.ts
// Single place the seed scripts get a PrismaClient from.
//
// Prisma 7 dropped the bundled query engine, so a client can no longer be
// constructed bare — it needs a driver adapter, and the CLI's .env loading
// doesn't apply to scripts run through ts-node. Both concerns are handled
// here so the eleven seeders don't each carry their own copy (and can't
// drift apart when the connection setup changes again).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — check your .env file');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
