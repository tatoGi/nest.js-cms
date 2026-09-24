// src/modules/page-templates/page-templates.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';

// Infrastructure
import { PrismaPageTemplatesRepository } from './infrastructure/prisma-page-templates.repository';

// Application
import { PageTemplatesService } from './application/page-templates.service';

// API
import { AdminPageTemplatesController } from './api/controllers/admin-page-templates.controller';
import { PublicPageTemplatesController } from './api/controllers/public-page-templates.controller';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100,
    }),
  ],
  controllers: [AdminPageTemplatesController, PublicPageTemplatesController],
  providers: [
    PageTemplatesService,
    {
      provide: 'IPageTemplatesRepository',
      useClass: PrismaPageTemplatesRepository,
    },
  ],
  exports: [PageTemplatesService, 'IPageTemplatesRepository'],
})
export class PageTemplatesModule {}
