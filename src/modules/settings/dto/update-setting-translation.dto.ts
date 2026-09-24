// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/dto/update-setting-translation.dto.ts
// ─────────────────────────────────────────────────────────────

import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingLocalizedContentDto {
  @ApiProperty({
    description: 'JSON value for the translation',
    example: {
      defaultMetaTitle: 'Enterprise Georgia',
      defaultMetaDescription: 'ბიზნესის მხარდაჭერა',
    },
  })
  @IsNotEmpty({ message: 'Value is required' })
  value: any;
}
