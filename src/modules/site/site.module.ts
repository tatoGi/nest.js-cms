// ─────────────────────────────────────────────────────────────
// File: src/modules/site/site.module.ts
// ─────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';

import { PublicSiteController } from './api/controllers/public-site.controller';
import { SiteService } from './application/site.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicSiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
