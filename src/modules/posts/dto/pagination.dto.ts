// src/modules/posts/dto/pagination.dto.ts

import { IntersectionType } from '@nestjs/swagger';
import { PageQueryDto } from '@/modules/pages/dto/page-query.dto';
// import { PaginationQueryDto } from '@/modules/menu/dto/pagination.dto';
import { PaginationQueryDto } from '@/common/pagination';

// export class PaginationQueryDto {
//   @ApiPropertyOptional({
//     description: 'Page number',
//     default: 1,
//     minimum: 1,
//   })
//   @IsOptional()
//   @IsInt()
//   @Min(1)
//   @Type(() => Number)
//   page?: number = 1;

//   @ApiPropertyOptional({
//     description: 'Items per page',
//     default: 10,
//     minimum: 1,
//     maximum: 100,
//   })
//   @IsOptional()
//   @IsInt()
//   @Min(1)
//   @Max(100)
//   @Type(() => Number)
//   limit?: number = 10;

//   @ApiPropertyOptional({
//     description: 'Sort field',
//     example: 'publishedAt',
//   })
//   @IsOptional()
//   @IsString()
//   sortBy?: string = 'publishedAt';

//   @ApiPropertyOptional({
//     description: 'Sort order',
//     enum: ['asc', 'desc'],
//     default: 'desc',
//   })
//   @IsOptional()
//   @IsIn(['asc', 'desc'])
//   sortOrder?: 'asc' | 'desc' = 'desc';
// }

// export class PaginatedResponseDto<T> {
//   @ApiProperty({ description: 'Data items' })
//   data: T[];

//   @ApiProperty({ description: 'Total number of items', example: 100 })
//   total: number;

//   @ApiProperty({ description: 'Current page', example: 1 })
//   page: number;

//   @ApiProperty({ description: 'Items per page', example: 10 })
//   limit: number;

//   @ApiProperty({ description: 'Total number of pages', example: 10 })
//   totalPages: number;
// }

export class PostPaginatedQueryDto extends IntersectionType(PageQueryDto, PaginationQueryDto) {}
