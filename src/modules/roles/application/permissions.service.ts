import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { IPermissionRepository } from '../domain/permission.repository';
import { CreatePermissionDto, UpdatePermissionDto, PermissionPaginatedQueryDto } from '../dto';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { ResourceNotFoundException } from '@/common/exceptions';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { PermissionsPermissions } from './roles.permissions';

@Injectable()
export class PermissionsService {
  constructor(
    @Inject('IPermissionRepository')
    private readonly permissionRepository: IPermissionRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(filters?: { search?: string; group?: string }): Promise<Permission[]> {
    return this.permissionRepository.findAll(filters);
  }

  async findAllGrouped(): Promise<Record<string, Permission[]>> {
    return this.permissionRepository.findAllGrouped();
  }

  async findAllPaginated(
    query: PermissionPaginatedQueryDto,
  ): Promise<PaginatedResponseDto<Permission>> {
    const result = await this.permissionRepository.findPaginated(
      { search: query.search, group: query.group },
      { page: query.page ?? 1, limit: query.limit ?? 10 },
    );
    return new PaginatedResponseDto(
      result.data,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async findOne(id: number): Promise<Permission> {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) throw new ResourceNotFoundException('Permission', id);
    return permission;
  }

  async create(dto: CreatePermissionDto, meta?: ActionMeta): Promise<Permission> {
    const keyTaken = await this.permissionRepository.keyExists(dto.key);
    if (keyTaken) {
      throw new AppException(
        ErrorCodes.UNIQUE_CONSTRAINT,
        `Permission key "${dto.key}" already exists`,
        HttpStatus.CONFLICT,
      );
    }
    const permission = await this.permissionRepository.create(dto);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PermissionsPermissions.CREATE_PERMISSIONS,
      targetType: 'permission',
      targetId: permission.id,
      after: { key: permission.key, label: permission.label, group: permission.group },
      ip: meta?.ip,
    });
    return permission;
  }

  async update(id: number, dto: UpdatePermissionDto, meta?: ActionMeta): Promise<Permission> {
    const before = await this.findOne(id);
    if (dto.key) {
      const keyTaken = await this.permissionRepository.keyExists(dto.key, id);
      if (keyTaken) {
        throw new AppException(
          ErrorCodes.UNIQUE_CONSTRAINT,
          `Permission key "${dto.key}" already exists`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const updated = await this.permissionRepository.update(id, dto);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PermissionsPermissions.UPDATE_PERMISSIONS,
      targetType: 'permission',
      targetId: id,
      before: { key: before.key, label: before.label, group: before.group },
      after: { key: updated.key, label: updated.label, group: updated.group },
      ip: meta?.ip,
    });
    return updated;
  }

  async remove(id: number, meta?: ActionMeta): Promise<void> {
    const permission = await this.findOne(id);
    const hasRoles = await this.permissionRepository.hasRoles(id);
    if (hasRoles) {
      throw new AppException(
        ErrorCodes.RELATION_VIOLATION,
        'Cannot delete permission that is assigned to one or more roles',
        HttpStatus.CONFLICT,
      );
    }
    await this.permissionRepository.delete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: PermissionsPermissions.DELETE_PERMISSIONS,
      targetType: 'permission',
      targetId: id,
      before: { key: permission.key, label: permission.label, group: permission.group },
      ip: meta?.ip,
    });
  }
}
