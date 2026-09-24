import {
  IsString,
  IsEmail,
  IsInt,
  IsArray,
  IsOptional,
  IsBoolean,
  IsPositive,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(255)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(255)
  lastName: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Defaults to "firstName lastName" if omitted',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  displayName?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: [1, 2], description: 'Role IDs to assign', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  roleIds: number[];

  @ApiPropertyOptional({
    example: 3,
    description: 'Media record ID for the avatar',
    nullable: true,
  })
  @ValidateIf((o) => o.avatarMediaId !== null)
  @IsInt()
  @IsPositive()
  @IsOptional()
  avatarMediaId?: number | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
