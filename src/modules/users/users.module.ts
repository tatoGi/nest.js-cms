import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersService } from './application/users.service';
import { AdminUsersController } from './api/controllers/admin-users.controller';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [AdminUsersController],
  providers: [
    UsersService,
    {
      provide: 'IUserRepository',
      useClass: PrismaUserRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
