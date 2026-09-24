// src/modules/page-templates/dto/update-page-template.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreatePageTemplateDto } from './create-page-template.dto';

export class UpdatePageTemplateDto extends PartialType(CreatePageTemplateDto) {}
