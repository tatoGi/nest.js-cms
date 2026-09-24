// src/modules/languages/languages.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';

// Infrastructure
import { PrismaLanguageRepository } from './infrastructure/prisma-languages.repository';

// Application
import { LanguagesService } from './application/languages.service';

// API
import { AdminLanguagesController } from './api/controllers/admin-languages.controller';
import { PublicLanguagesController } from './api/controllers/public-languages.controller';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // Maximum number of items in cache
    }),
  ],
  controllers: [AdminLanguagesController, PublicLanguagesController],
  providers: [
    // Service
    LanguagesService,

    // Repository (using dependency injection token)
    {
      provide: 'ILanguageRepository',
      useClass: PrismaLanguageRepository,
    },
  ],
  exports: [LanguagesService, 'ILanguageRepository'],
})
export class LanguagesModule {}
