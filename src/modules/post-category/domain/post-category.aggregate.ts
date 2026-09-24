import { PostCategory, PostCategoryTranslation } from '@prisma/client';

export type PostCategoryAggregate = PostCategory & {
  translations: PostCategoryTranslation[];
  children?: PostCategoryAggregate[];
  _count?: {
    posts: number;
  };
};
