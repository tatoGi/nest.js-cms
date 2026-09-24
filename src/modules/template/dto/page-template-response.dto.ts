// src/modules/page-templates/dto/page-template-response.dto.ts

import { LanguageResponseDto } from '@/modules/langueges/dto';

export class UserBasicDto {
  id: number;
  email: string;
  role: string;
}

// export class LanguageDto {
//   id: number;
//   code: string;
//   name: string;
//   englishName?: string;
//   georgianName?: string;
//   flagEmoji?: string;
// }

export class PageTemplateTranslationResponseDto {
  id: number;
  name: string;
  language: LanguageResponseDto;
}

export class PageTemplateResponseDto {
  id: number;
  slug: string;
  translations: PageTemplateTranslationResponseDto[];
  createdBy?: UserBasicDto;
  updatedBy?: UserBasicDto;
  createdAt: Date;
  updatedAt: Date;
}
