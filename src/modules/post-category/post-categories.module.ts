import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';

// Controllers
import { AdminPostCategoriesController } from './api/controllers/admin-post-categories.controller';

// Application
import { PostCategoryService } from './application/post-category.service';

// Domain (abstract ports)
import { PostCategoryRepository } from './domain/post-category.repository';
import { PostCategoryTranslationRepository } from './domain/post-category-translation.repository';
import { PostCategoryAggregateRepository } from './domain/post-category.aggregate.repository';

// Infrastructure (Prisma implementations)
import { PrismaPostCategoryRepository } from './infrastructure/prisma-post-category.repository';
import { PrismaPostCategoryTranslationRepository } from './infrastructure/prisma-post-category-translation.repository';
import { PrismaPostCategoryAggregateRepository } from './infrastructure/prisma-post-category.aggregate.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPostCategoriesController],
  providers: [
    PostCategoryService,
    {
      provide: PostCategoryRepository,
      useClass: PrismaPostCategoryRepository,
    },
    {
      provide: PostCategoryTranslationRepository,
      useClass: PrismaPostCategoryTranslationRepository,
    },
    {
      provide: PostCategoryAggregateRepository,
      useClass: PrismaPostCategoryAggregateRepository,
    },
  ],
  exports: [PostCategoryService],
})
export class PostCategoriesModule {}
