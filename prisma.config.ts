// Prisma 7 moved connection configuration out of schema.prisma: the datasource
// block no longer accepts `url`, and the CLI no longer auto-loads .env. Both
// responsibilities live here now.
//
// This file is read by the Prisma CLI only (migrate/db/studio/generate). The
// application and the seed scripts open their own connections through the
// pg driver adapter — see src/common/prisma/prisma.service.ts.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: env('DATABASE_URL'),
  },

  migrations: {
    path: 'prisma/migrations',
    // Replaces the `prisma.seed` key in package.json, which Prisma 7 ignores.
    seed: 'ts-node -P prisma/seeds/tsconfig.json prisma/seeds/seed.ts',
  },
});
