// src/modules/block-types/block-types.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';

// Infrastructure
import { PrismaBlockTypeRepository } from './infrastructure/prisma-block-type.repository';

// Application
import { BlockTypesService } from './application/block-types.service';

// API
import { AdminBlockTypesController } from './api/controllers/admin-block-types.controller';
// import { PublicBlockTypesController } from './api/controllers/public-block-types.controller'

@Module({
  imports: [
    PrismaModule,
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // Maximum number of items in cache
    }),
  ],
  controllers: [AdminBlockTypesController /* PublicBlockTypesController */],
  providers: [
    // Service
    BlockTypesService,

    // Repository (using dependency injection token)
    {
      provide: 'IBlockTypeRepository',
      useClass: PrismaBlockTypeRepository,
    },
  ],
  exports: [BlockTypesService, 'IBlockTypeRepository'],
})
export class BlockTypesModule {}
