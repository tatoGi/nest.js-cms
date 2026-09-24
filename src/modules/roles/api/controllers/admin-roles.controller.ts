import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { RolesService } from '../../application/roles.service';
import { RolesPermissions } from '../../application/roles.permissions';
import { CreateRoleDto, UpdateRoleDto, RolePaginatedQueryDto, SetPermissionsDto } from '../../dto';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';

@ApiTags('Admin - Roles')
@Controller('admin/roles')
@RequirePermissions(RolesPermissions.VIEW_ROLES)
export class AdminRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all roles (no pagination)' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated roles' })
  @ApiOkResponse({ description: 'Paginated roles' })
  async findAllPaginated(
    @Query() query: RolePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.rolesService.findAllPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(RolesPermissions.CREATE_ROLES)
  @ApiOperation({ summary: 'Create a role' })
  @ApiCreatedResponse({ description: 'Role created' })
  async create(@Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.rolesService.create(dto, getMeta(req));
  }

  @Patch(':id')
  @RequirePermissions(RolesPermissions.UPDATE_ROLES)
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @Req() req: Request,
  ) {
    return this.rolesService.update(id, dto, getMeta(req));
  }

  @Put(':id/permissions')
  @RequirePermissions(RolesPermissions.UPDATE_ROLES)
  @ApiOperation({ summary: 'Replace all permissions for a role' })
  async setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPermissionsDto,
    @Req() req: Request,
  ) {
    return this.rolesService.setPermissions(id, dto.permissionIds, getMeta(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(RolesPermissions.DELETE_ROLES)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiNoContentResponse({ description: 'Role deleted' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.rolesService.remove(id, getMeta(req));
  }
}
