// src/modules/menus/menus.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';

// Infrastructure - Repositories
import { PrismaMenuAggregateRepository } from './infrastructure/prisma-menu-aggregate.repository';

// Application
import { MenusService } from './application/menus.service';

// API - Controllers
import { AdminMenusController } from './api/controllers/admin-menus.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100,
    }),
  ],
  controllers: [AdminMenusController],
  providers: [
    // Service
    MenusService,

    // Repository bindings
    {
      provide: 'IMenuAggregateRepository',
      useClass: PrismaMenuAggregateRepository,
    },
  ],
  exports: [MenusService, 'IMenuAggregateRepository'],
})
export class MenusModule {}
