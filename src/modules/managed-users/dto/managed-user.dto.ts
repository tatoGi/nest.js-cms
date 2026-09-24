import { OmitType, PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from '@/modules/users/dto';

// The target role is never a free-form roleIds array — the caller may only
// pick from the managed role slugs their own role(s) are permitted to
// manage (see ManagedUsersService.getManagedRoleSlugs). If a caller only
// manages a single role, roleSlug can be omitted and is inferred.
export class CreateManagedUserDto extends OmitType(CreateUserDto, ['roleIds'] as const) {
  @ApiPropertyOptional({
    example: 'operator',
    description:
      'Slug of the managed role to assign. Optional if the caller manages exactly one role.',
  })
  @IsString()
  @IsOptional()
  roleSlug?: string;
}

export class UpdateManagedUserDto extends PartialType(
  OmitType(CreateUserDto, ['roleIds', 'password'] as const),
) {}

export class BulkManagedUserIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
