import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { UsersService } from '../../application/users.service';
import { UsersPermissions } from '../../application/users.permissions';
import {
  CreateUserDto,
  UpdateUserDto,
  UserPaginatedQueryDto,
  ChangePasswordDto,
  SetUserPermissionDto,
} from '../../dto';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';

@ApiTags('Admin - Users')
@Controller('admin/users')
@RequirePermissions(UsersPermissions.VIEW_USERS)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated users' })
  async findAllPaginated(
    @Query() query: UserPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.usersService.findAllPaginated(query);
  }

  @Get('trash')
  @RequirePermissions(UsersPermissions.DELETE_USERS)
  @ApiOperation({ summary: 'Get trashed (soft-deleted) users' })
  async getTrash(@Query() query: UserPaginatedQueryDto): Promise<PaginatedResponseDto<any>> {
    return this.usersService.findTrashedPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(UsersPermissions.CREATE_USERS)
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ description: 'User created' })
  async create(@Body() dto: CreateUserDto, @Req() req: Request) {
    return this.usersService.create(dto, getMeta(req));
  }

  @Patch(':id')
  @RequirePermissions(UsersPermissions.UPDATE_USERS)
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.update(id, dto, getMeta(req));
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(UsersPermissions.UPDATE_USERS)
  @ApiOperation({ summary: 'Change user password' })
  @ApiNoContentResponse({ description: 'Password changed' })
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    return this.usersService.changePassword(id, dto.password, getMeta(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(UsersPermissions.DELETE_USERS)
  @ApiOperation({ summary: 'Move user to trash' })
  @ApiNoContentResponse({ description: 'User trashed' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.usersService.softDelete(id, getMeta(req));
  }

  @Patch(':id/restore')
  @RequirePermissions(UsersPermissions.DELETE_USERS)
  @ApiOperation({ summary: 'Restore a trashed user' })
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.usersService.restore(id, getMeta(req));
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(UsersPermissions.DELETE_USERS)
  @ApiOperation({ summary: 'Permanently delete a user' })
  @ApiNoContentResponse({ description: 'User permanently deleted' })
  async hardDelete(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.usersService.hardDelete(id, getMeta(req));
  }

  // ─── Direct permissions ──────────────────────────────────────

  @Get(':id/permissions')
  @RequirePermissions(UsersPermissions.UPDATE_USERS)
  @ApiOperation({ summary: 'Get all permissions for a user with their sources' })
  @ApiOkResponse({ description: 'User permissions' })
  async getUserPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserPermissions(id);
  }

  @Post(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(UsersPermissions.UPDATE_USERS)
  @ApiOperation({ summary: 'Grant or revoke a direct permission for a user' })
  @ApiNoContentResponse({ description: 'Permission set' })
  async setPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserPermissionDto,
    @Req() req: Request,
  ): Promise<void> {
    return this.usersService.setPermission(id, dto, getMeta(req));
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(UsersPermissions.UPDATE_USERS)
  @ApiOperation({ summary: 'Remove a direct permission override from a user' })
  @ApiNoContentResponse({ description: 'Permission removed' })
  async removePermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
    @Req() req: Request,
  ): Promise<void> {
    return this.usersService.removePermission(id, permissionId, getMeta(req));
  }
}
