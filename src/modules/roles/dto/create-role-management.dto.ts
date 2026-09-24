import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleManagementDto {
  @ApiProperty({
    example: 'chat-supervisor',
    description: 'Slug of the role that manages another role',
  })
  @IsString()
  @IsNotEmpty()
  managerRoleSlug: string;

  @ApiProperty({ example: 'operator', description: 'Slug of the role being managed' })
  @IsString()
  @IsNotEmpty()
  managedRoleSlug: string;
}
