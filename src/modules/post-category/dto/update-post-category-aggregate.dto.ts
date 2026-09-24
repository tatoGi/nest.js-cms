import { PartialType } from '@nestjs/mapped-types';
import { CreatePostCategoryAggregateDto } from './create-post-category-aggregate.dto';

export class UpdatePostCategoryAggregateDto extends PartialType(CreatePostCategoryAggregateDto) {}
