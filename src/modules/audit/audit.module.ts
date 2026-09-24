import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditService } from './audit.service';
import { AdminAuditController } from './api/admin-audit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
