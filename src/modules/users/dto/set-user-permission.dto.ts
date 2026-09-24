import { IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserPermissionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  permissionId: number;

  @ApiProperty({ example: true, description: 'true = grant, false = revoke' })
  @IsBoolean()
  granted: boolean;
}
