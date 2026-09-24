// src/modules/pages/pages.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

// Infrastructure - Repositories
import { PrismaPageRepository } from './infrastructure/prisma-page.repository';
import { PrismaPageAggregateRepository } from './infrastructure/prisma-page-aggregate.repository';
import { PrismaPageTranslationRepository } from './infrastructure/prisma-page-translation.repository';
import { PrismaPageBlockRepository } from './infrastructure/prisma-page-block.repository';

// Application
import { PagesService } from './application/page.service';

// API - Controllers
import { AdminPagesController } from './api/controllers/admin-pages.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100,
    }),
  ],
  controllers: [AdminPagesController],
  providers: [
    // Service
    PagesService,

    // Repository bindings
    {
      provide: 'IPageRepository',
      useClass: PrismaPageRepository,
    },
    {
      provide: 'IPageAggregateRepository',
      useClass: PrismaPageAggregateRepository,
    },
    {
      provide: 'IPageTranslationRepository',
      useClass: PrismaPageTranslationRepository,
    },
    {
      provide: 'IPageBlockRepository',
      useClass: PrismaPageBlockRepository,
    },
  ],
  exports: [
    PagesService,
    'IPageRepository',
    'IPageAggregateRepository',
    'IPageTranslationRepository',
    'IPageBlockRepository',
  ],
})
export class PagesModule {}
