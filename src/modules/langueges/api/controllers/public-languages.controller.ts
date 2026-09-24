// src/modules/languages/api/controllers/public-languages.controller.ts

import { Controller, Get, Param, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';

import { LanguagesService } from '../../application/languages.service';
import { LanguageResponseDto } from '../../dto/language-response.dto';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';

@ApiTags('Public - Languages')
@Controller('languages')
@UseInterceptors(CacheInterceptor('languages'))
export class PublicLanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /**
   * Get all active languages
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active languages',
    description: 'Retrieves all active languages for public use',
  })
  @ApiOkResponse({
    description: 'Languages retrieved successfully',
    type: [LanguageResponseDto],
  })
  async findAllActive(): Promise<LanguageResponseDto[]> {
    return this.languagesService.findActive();
  }

  /**
   * Get default language
   */
  @Get('default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get default language',
    description: 'Retrieves the default language for the site',
  })
  @ApiOkResponse({
    description: 'Default language retrieved successfully',
    type: LanguageResponseDto,
  })
  async findDefault(): Promise<LanguageResponseDto> {
    return this.languagesService.findDefault();
  }

  /**
   * Get a language by code
   */
  @Get('code/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a language by code',
    description: 'Retrieves a language by its ISO code',
  })
  @ApiParam({
    name: 'code',
    description: 'Language ISO code',
    example: 'en',
  })
  @ApiOkResponse({
    description: 'Language retrieved successfully',
    type: LanguageResponseDto,
  })
  async findByCode(@Param('code') code: string): Promise<LanguageResponseDto> {
    return this.languagesService.findByCode(code);
  }
}
