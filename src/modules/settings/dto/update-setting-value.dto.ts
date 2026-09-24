// ─────────────────────────────────────────────────────────────
// File: src/modules/settings/dto/update-setting-value.dto.ts
// ─────────────────────────────────────────────────────────────

import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsettingGlobalContentDto {
  @ApiProperty({
    description: 'JSON value for the setting',
    example: { address: 'თბილისი, მარჯანიშვილის ქ. 5', phone: '+995 32 296 0010' },
  })
  @IsNotEmpty({ message: 'Value is required' })
  value: any;
}
