// src/modules/posts/domain/index.ts

// Aggregate types
export {
  Post,
  PostTranslation,
  PostContentBlock,
  PostSlugAlias,
  PostAggregate,
} from './post.aggregate';

// Post repository interface
export { PostFilters, CreatePostData, UpdatePostData, IPostRepository } from './post.repository';

// Post aggregate repository interface
export { IPostAggregateRepository } from './post-aggregate.repository';

// Post translation repository interface
export {
  DbPostTranslation,
  PostTranslationFilters,
  CreatePostTranslationData,
  UpdatePostTranslationData,
  IPostTranslationRepository,
} from './post-translation.repository';

// Post block repository interface
export {
  DbPostContentBlock,
  PostBlockFilters,
  CreatePostBlockData,
  UpdatePostBlockData,
  IPostBlockRepository,
} from './post-block.repository';
