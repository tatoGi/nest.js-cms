// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.logger';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

// Common modules
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

// Feature modules
import { BlockTypesModule } from './modules/block-types/block-types.module';
import { LanguagesModule } from './modules/langueges/language.module';
import { PagesModule } from './modules/pages/pages.module';
import { AuthModule } from './modules/auth/auth.module';
import { PageTemplatesModule } from './modules/template/page-templates.module';
// import { PageModule } from './modules/page/page.module';
import { PostsModule } from './modules/posts/posts.module';
import { MenusModule } from './modules/menu/menus.module';
import { PostCategoriesModule } from './modules/post-category/post-categories.module';
import { MediaModule } from './modules/media/media.module';
import { SiteModule } from './modules/site/site.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { ManagedUsersModule } from './modules/managed-users/managed-users.module';

@Module({
  imports: [
    // ===================================
    // Configuration
    // ===================================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    WinstonModule.forRoot(winstonConfig),

    // ===================================
    // Cache
    // ===================================
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default
      max: 100, // Maximum number of items in cache
    }),

    // ===================================
    // Rate Limiting
    // ===================================
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // ===================================
    // Scheduling (for background jobs)
    // ===================================
    ScheduleModule.forRoot(),

    // ===================================
    // Common Modules
    // ===================================
    PrismaModule,

    // ===================================
    // Feature Modules
    // ===================================
    LanguagesModule,
    BlockTypesModule,
    PagesModule,
    AuthModule,
    PageTemplatesModule,
    PostsModule,
    PostCategoriesModule,
    MenusModule,
    MediaModule,
    SiteModule,
    SettingsModule,
    RolesModule,
    UsersModule,
    AuditModule,
    NotificationsModule,
    ChatModule,
    ManagedUsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
