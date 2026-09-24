import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Password is updated via a dedicated endpoint, so omit it here
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}
