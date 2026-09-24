// src/modules/auth/dto/forgot-password.dto.ts

import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'admin@admin.com',
    description: 'Email of the account to send a password reset link to',
  })
  @IsEmail()
  email: string;
}
