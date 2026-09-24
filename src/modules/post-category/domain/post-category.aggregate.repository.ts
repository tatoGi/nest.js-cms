import { PostCategoryAggregate } from './post-category.aggregate';
import { CreatePostCategoryAggregateDto } from '../dto/create-post-category-aggregate.dto';

export abstract class PostCategoryAggregateRepository {
  abstract createAggregate(dto: CreatePostCategoryAggregateDto): Promise<PostCategoryAggregate>;

  abstract updateAggregate(
    id: number,
    dto: Partial<CreatePostCategoryAggregateDto>,
  ): Promise<PostCategoryAggregate>;

  abstract deleteAggregate(id: number): Promise<void>;
}
