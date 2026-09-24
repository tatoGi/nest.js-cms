import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { NotificationsService } from './application/notifications.service';
import { AdminNotificationsController } from './api/admin-notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
