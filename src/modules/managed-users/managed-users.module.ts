import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { UsersModule } from '@/modules/users/users.module';
import { ManagedUsersService } from './application/managed-users.service';
import { ManagedUsersController } from './api/managed-users.controller';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ManagedUsersController],
  providers: [ManagedUsersService],
  exports: [ManagedUsersService],
})
export class ManagedUsersModule {}
