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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { PermissionsService } from '../../application/permissions.service';
import { PermissionsPermissions } from '../../application/roles.permissions';
import { CreatePermissionDto, UpdatePermissionDto, PermissionPaginatedQueryDto } from '../../dto';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';

@ApiTags('Admin - Permissions')
@Controller('admin/permissions')
@RequirePermissions(PermissionsPermissions.VIEW_PERMISSIONS)
export class AdminPermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all permissions grouped by group' })
  @ApiOkResponse({ description: 'All permissions grouped' })
  async findAllGrouped() {
    return this.permissionsService.findAllGrouped();
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated permissions' })
  @ApiOkResponse({ description: 'Paginated permissions' })
  async findAllPaginated(
    @Query() query: PermissionPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.permissionsService.findAllPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get permission by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PermissionsPermissions.CREATE_PERMISSIONS)
  @ApiOperation({ summary: 'Create a permission' })
  @ApiCreatedResponse({ description: 'Permission created' })
  async create(@Body() dto: CreatePermissionDto, @Req() req: Request) {
    return this.permissionsService.create(dto, getMeta(req));
  }

  @Patch(':id')
  @RequirePermissions(PermissionsPermissions.UPDATE_PERMISSIONS)
  @ApiOperation({ summary: 'Update a permission' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto,
    @Req() req: Request,
  ) {
    return this.permissionsService.update(id, dto, getMeta(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionsPermissions.DELETE_PERMISSIONS)
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiNoContentResponse({ description: 'Permission deleted' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request): Promise<void> {
    return this.permissionsService.remove(id, getMeta(req));
  }
}
