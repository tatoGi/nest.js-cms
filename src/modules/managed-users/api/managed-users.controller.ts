import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { getMeta } from '@/common/helper/action-meta';
import { JwtUser } from '@/modules/auth/interface/jwt-user.interface';
import { UsersService } from '@/modules/users/application/users.service';
import { UserPaginatedQueryDto } from '@/modules/users/dto';
import { ManagedUsersService } from '../application/managed-users.service';
import {
  BulkManagedUserIdsDto,
  CreateManagedUserDto,
  UpdateManagedUserDto,
} from '../dto/managed-user.dto';

// Generic replacement for one-off controllers like the old
// ChatOperatorUsersController. Which role(s) a caller may CRUD is resolved
// from the RoleManagement table via the caller's own role slugs (taken from
// the JWT, never from client input) — adding a new manager/subordinate pair
// is a data change, not a new controller.
@ApiTags('Managed Users')
@ApiBearerAuth('JWT-auth')
@Controller('managed-users')
@RequirePermissions('users.manage_scoped')
export class ManagedUsersController {
  constructor(
    private readonly managedUsersService: ManagedUsersService,
    private readonly usersService: UsersService,
  ) {}

  private callerRoleSlugs(req: Request): string[] {
    return (req.user as JwtUser).roles;
  }

  @Get()
  async list(@Query() query: UserPaginatedQueryDto, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    return this.usersService.findAllPaginated(
      query,
      managedRoles.map((r) => r.id),
    );
  }

  @Get('trash')
  async getTrash(@Query() query: UserPaginatedQueryDto, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    return this.usersService.findTrashedPaginated(
      query,
      managedRoles.map((r) => r.id),
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    await this.managedUsersService.assertIsManaged(
      +id,
      managedRoles.map((r) => r.id),
    );
    return this.usersService.findOne(+id);
  }

  @Post()
  async create(@Body() dto: CreateManagedUserDto, @Req() req: Request) {
    const { roleSlug, ...rest } = dto;
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    const targetRole = this.managedUsersService.resolveTargetRole(managedRoles, roleSlug);
    return this.usersService.create({ ...rest, roleIds: [targetRole.id] }, getMeta(req));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateManagedUserDto, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    await this.managedUsersService.assertIsManaged(
      +id,
      managedRoles.map((r) => r.id),
    );
    return this.usersService.update(+id, dto, getMeta(req));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    await this.managedUsersService.assertIsManaged(
      +id,
      managedRoles.map((r) => r.id),
    );
    return this.usersService.softDelete(+id, getMeta(req));
  }

  @Patch(':id/restore')
  async restore(@Param('id') id: string, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    await this.managedUsersService.assertIsManaged(
      +id,
      managedRoles.map((r) => r.id),
    );
    return this.usersService.restore(+id, getMeta(req));
  }

  // Loops rather than a single Prisma updateMany — each id must pass the
  // same per-user assertIsManaged scoping check as the single-item route
  // above, since bulk selection could otherwise be used to restore/delete
  // users outside the caller's managed roles.
  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  async bulkRestore(@Body() dto: BulkManagedUserIdsDto, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    const roleIds = managedRoles.map((r) => r.id);
    for (const id of dto.ids) {
      await this.managedUsersService.assertIsManaged(id, roleIds);
      await this.usersService.restore(id, getMeta(req));
    }
  }

  @Delete(':id/hard')
  async hardDelete(@Param('id') id: string, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    await this.managedUsersService.assertIsManaged(
      +id,
      managedRoles.map((r) => r.id),
    );
    return this.usersService.hardDelete(+id, getMeta(req));
  }

  @Post('bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  async bulkHardDelete(@Body() dto: BulkManagedUserIdsDto, @Req() req: Request) {
    const managedRoles = await this.managedUsersService.getManagedRoles(this.callerRoleSlugs(req));
    const roleIds = managedRoles.map((r) => r.id);
    for (const id of dto.ids) {
      await this.managedUsersService.assertIsManaged(id, roleIds);
      await this.usersService.hardDelete(id, getMeta(req));
    }
  }
}
