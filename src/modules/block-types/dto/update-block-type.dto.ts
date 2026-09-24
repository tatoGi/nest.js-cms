import { PartialType } from '@nestjs/swagger';
import { CreateBlockTypeDto } from './create-block-type.dto';

export class UpdateBlockTypeDto extends PartialType(CreateBlockTypeDto) {}
