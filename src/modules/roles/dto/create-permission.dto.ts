import { IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'pages.view',
    description: 'Unique key (dot notation, e.g. resource.action)',
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'Key must contain only lowercase letters, numbers, dots, hyphens, or underscores',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  key: string;

  @ApiProperty({ example: 'View Pages' })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({ example: 'pages', description: 'Group name for grouping related permissions' })
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.toLowerCase().trim())
  group: string;
}
