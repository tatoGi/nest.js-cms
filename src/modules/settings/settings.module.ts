// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/settings.module.ts
// ─────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';

import { AdminSettingsController } from './api/controllers/admin-settings.controller';
// import { PublicSettingsController } from './api/controllers/public-settings.controller';
import { SettingsService } from './application/settings.service';
import { SettingsRepository } from './domain/settings.repository';
import { PrismaSettingsRepository } from './infrastructure/prisma-settings.repository';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminSettingsController],
  providers: [
    SettingsService,
    {
      provide: SettingsRepository,
      useClass: PrismaSettingsRepository,
    },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
