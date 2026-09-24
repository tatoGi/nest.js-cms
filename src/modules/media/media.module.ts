// ─────────────────────────────────────────────────────────────
// File: src/modules/media/media.module.ts
// ─────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
// import { PermissionsModule } from '@/common/permissions/permissions.decorator';

// Controllers
import { AdminMediaController } from './api/controllers/admin-media.controller';
import { AdminMediaFoldersController } from './api/controllers/admin-media-folders.controller';

// Application
import { MediaService } from './application/media.service';
import { MediaFoldersService } from './application/media-folders.service';

// Domain (abstract port)
import { MediaRepository } from './domain/media.repository';

// Infrastructure (implementations)
import { PrismaMediaRepository } from './infrastructure/prisma-media.repository';
import { StorageService } from './infrastructure/storage.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminMediaController, AdminMediaFoldersController],
  providers: [
    MediaService,
    MediaFoldersService,
    StorageService,
    {
      provide: MediaRepository,
      useClass: PrismaMediaRepository,
    },
  ],
  exports: [MediaService, MediaFoldersService, StorageService],
})
export class MediaModule {}
