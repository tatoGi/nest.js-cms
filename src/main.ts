// src/main.ts

import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Interceptors
import { LoggingInterceptor, TimeoutInterceptor } from './common/interceptors';

// Filters
import { AllExceptionsFilter, PrismaClientExceptionFilter } from './common/filters';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ===================================
  // Trust proxy — required to get real client IP from x-forwarded-for
  // (behind nginx, Cloudflare, load balancers, or Next.js dev proxy)
  // ===================================
  app.set('trust proxy', true);

  // ===================================
  // WebSocket adapter (Socket.IO)
  // ===================================
  app.useWebSocketAdapter(new IoAdapter(app));

  // ===================================
  // Cookie parser (REQUIRED for refresh tokens)
  // ===================================
  app.use(cookieParser());

  // ===================================
  // CORS Configuration (Next.js ready)
  // ===================================
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    exposedHeaders: ['Authorization'],
  });

  // ===================================
  // Global Prefix
  // ===================================
  app.setGlobalPrefix('api', {
    exclude: ['health', 'metrics'],
  });

  // ===================================
  // Global Validation Pipe
  // ===================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
      exceptionFactory: (errors) => {
        const details = errors.map((error) => ({
          field: error.property,
          errors: Object.values(error.constraints || {}),
        }));
        return new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        });
      },
    }),
  );

  // ===================================
  // Global Interceptors
  // ===================================
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(30000), // 30s timeout
  );

  // ===================================
  // Global Exception Filters
  // ===================================
  // Register AllExceptionsFilter FIRST (lower priority / catch-all fallback),
  // PrismaClientExceptionFilter LAST (higher priority, handles specific Prisma errors).
  // NestJS applies the last-registered filter first for matching exceptions.
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaClientExceptionFilter());
  // ===================================
  // Swagger Documentation
  // ===================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CMS API')
    .setDescription('Content Management System API')
    .setVersion('1.0')
    .addTag('Auth', 'Authentication & authorization')
    .addTag('Languages', 'Language management')
    .addTag('Pages', 'Page management')
    .addTag('Posts', 'Post management')
    .addTag('Block Types', 'Block type definitions')
    .addTag('Menus', 'Menu management')
    .addTag('Media', 'Media library')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'CMS API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  // ===================================
  // Health Check
  // ===================================
  app.getHttpAdapter().get('/health', (_, res: any) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // ===================================
  // Start Server
  // ===================================
  // Static Uploads — path from env, falls back to ./uploads for local dev
  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 Server running at http://localhost:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  logger.log(`🏥 Health check at http://localhost:${port}/health`);
}

bootstrap();
