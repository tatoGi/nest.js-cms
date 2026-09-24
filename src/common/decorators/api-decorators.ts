// src/common/decorators/api-decorators.ts

import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiConflictResponse,
  ApiParam,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';

/**
 * API ID parameter decorator
 *
 * @param name - Parameter name (default: 'id')
 * @param description - Parameter description
 *
 * @example
 * ```typescript
 * @ApiIdParam('id', 'Block type ID')
 * @Get(':id')
 * async findOne(@Param('id', ParseIntPipe) id: number) {}
 * ```
 */
export const ApiIdParam = (name: string = 'id', description?: string) => {
  return ApiParam({
    name,
    type: Number,
    description: description || `${name.charAt(0).toUpperCase() + name.slice(1)} identifier`,
    required: true,
    example: 1,
  });
};

/**
 * Apply standard API error responses
 *
 * Adds: 400, 401, 403, 404, 409, 500
 *
 * @example
 * ```typescript
 * @ApiStandardResponses()
 * @Get(':id')
 * async findOne(@Param('id') id: number) {}
 * ```
 */
export const ApiStandardResponses = () => {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'Bad Request - Invalid input data',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Missing or invalid authentication',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 401 },
          message: { type: 'string', example: 'Unauthorized' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Insufficient permissions',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 403 },
          message: { type: 'string', example: 'Insufficient permissions' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'Not Found - Resource does not exist',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'Resource not found' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
    ApiConflictResponse({
      description: 'Conflict - Resource already exists',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 409 },
          message: { type: 'string', example: 'Resource already exists' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal Server Error',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 500 },
          message: { type: 'string', example: 'Internal server error' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
  );
};

/**
 * API paginated response decorator
 *
 * @param model - DTO class for items
 *
 * @example
 * ```typescript
 * @ApiPaginatedResponse(UserDto)
 * @Get()
 * async findAll(@Query() query: PaginationDto) {}
 * ```
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Successfully received paginated list',
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  total: {
                    type: 'number',
                    description: 'Total number of items',
                    example: 100,
                  },
                  page: {
                    type: 'number',
                    description: 'Current page number',
                    example: 1,
                  },
                  limit: {
                    type: 'number',
                    description: 'Items per page',
                    example: 10,
                  },
                  totalPages: {
                    type: 'number',
                    description: 'Total number of pages',
                    example: 10,
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
