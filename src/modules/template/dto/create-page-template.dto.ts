// src/modules/page-templates/dto/create-page-template.dto.ts

import { IsString, MaxLength, IsInt, MinLength, Matches } from 'class-validator';

export class PageTemplateTranslationDto {
  @IsInt()
  languageId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}

export class CreatePageTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase with hyphens (e.g., "home-page")',
  })
  slug: string;
}
