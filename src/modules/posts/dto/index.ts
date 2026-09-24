// src/modules/posts/dto/index.ts

// Create DTOs
export {
  CreatePostAggregateDto,
  CreatePostTranslationDto,
  CreatePostBlockDto,
} from './create-post-aggregate.dto';

// Update DTOs
export {
  UpdatePostAggregateDto,
  UpdatePostTranslationDto,
  UpdatePostBlockDto,
} from './update-post-aggregate.dto';

// Response DTOs
export {
  PostAggregateResponseDto,
  PostTranslationResponseDto,
  PostBlockResponseDto,
  PostSlugAliasResponseDto,
  PostAuthorResponseDto,
} from './post-aggregate-response.dto';

// List DTOs
export { PostListItemDto, PostListTranslationDto, PostListAuthorDto } from './post-list-item.dto';

// Query DTOs
export { PostQueryDto } from './post-query.dto';

// Pagination DTOs
export { PostPaginatedQueryDto } from './pagination.dto';
