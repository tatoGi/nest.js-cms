import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { RolesPermissions } from '../../application/roles.permissions';
import { RoleManagementService } from '../../application/role-management.service';
import { CreateRoleManagementDto } from '../../dto';

// Admin surface over the RoleManagement table that ManagedUsersController
// reads from. Adding a new manager/subordinate pairing (e.g. sales-supervisor
// -> sales-member) in production is a form submission here, not a seed
// script run against the live database.
@ApiTags('Admin - Role Management')
@Controller('admin/role-management')
@RequirePermissions(RolesPermissions.VIEW_ROLES)
export class AdminRoleManagementController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List all manager/subordinate role pairings' })
  async findAll() {
    return this.roleManagementService.findAll();
  }

  @Post()
  @RequirePermissions(RolesPermissions.UPDATE_ROLES)
  @ApiOperation({ summary: 'Add a manager/subordinate role pairing' })
  async create(@Body() dto: CreateRoleManagementDto, @Req() req: Request) {
    return this.roleManagementService.create(dto, getMeta(req));
  }

  @Delete(':id')
  @RequirePermissions(RolesPermissions.UPDATE_ROLES)
  @ApiOperation({ summary: 'Remove a manager/subordinate role pairing' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.roleManagementService.remove(id, getMeta(req));
  }
}
