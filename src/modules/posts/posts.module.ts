// src/modules/posts/posts.module.ts

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

import { AdminPostsController } from './api/controllers/admin-posts.controller';
import { PostsService } from './application/post.service';
import { PrismaPostAggregateRepository } from './infrastructure/prisma-post-aggregate.repository';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    CacheModule.register({
      ttl: 5 * 60 * 1000, // 5 minutes
      max: 100,
    }),
  ],
  controllers: [AdminPostsController],
  providers: [
    PostsService,
    {
      provide: 'IPostAggregateRepository',
      useClass: PrismaPostAggregateRepository,
    },
  ],
  exports: [PostsService],
})
export class PostsModule {}
