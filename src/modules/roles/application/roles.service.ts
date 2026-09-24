import { Injectable, Inject } from '@nestjs/common';
import { IRoleRepository, RoleWithPermissions } from '../domain/role.repository';
import { CreateRoleDto, UpdateRoleDto, RolePaginatedQueryDto } from '../dto';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { ResourceNotFoundException } from '@/common/exceptions';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { RolesPermissions } from './roles.permissions';

@Injectable()
export class RolesService {
  constructor(
    @Inject('IRoleRepository')
    private readonly roleRepository: IRoleRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(): Promise<RoleWithPermissions[]> {
    return this.roleRepository.findAll();
  }

  async findAllPaginated(
    query: RolePaginatedQueryDto,
  ): Promise<PaginatedResponseDto<RoleWithPermissions>> {
    const result = await this.roleRepository.findPaginated(
      { search: query.search },
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

  async findOne(id: number): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new ResourceNotFoundException('Role', id);
    return role;
  }

  async create(dto: CreateRoleDto, meta?: ActionMeta): Promise<RoleWithPermissions> {
    const slugTaken = await this.roleRepository.slugExists(dto.slug);
    if (slugTaken) {
      throw new AppException(
        ErrorCodes.UNIQUE_CONSTRAINT,
        `Role slug "${dto.slug}" already exists`,
        HttpStatus.CONFLICT,
      );
    }
    const role = await this.roleRepository.create(dto);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: RolesPermissions.CREATE_ROLES,
      targetType: 'role',
      targetId: role.id,
      after: { name: role.name, slug: role.slug, description: role.description },
      ip: meta?.ip,
    });
    return role;
  }

  async update(id: number, dto: UpdateRoleDto, meta?: ActionMeta): Promise<RoleWithPermissions> {
    const before = await this.findOne(id);
    if (dto.slug) {
      const slugTaken = await this.roleRepository.slugExists(dto.slug, id);
      if (slugTaken) {
        throw new AppException(
          ErrorCodes.UNIQUE_CONSTRAINT,
          `Role slug "${dto.slug}" already exists`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const updated = await this.roleRepository.update(id, dto);
    if (dto.permissionIds !== undefined) {
      await this.roleRepository.setPermissions(id, dto.permissionIds);
      const final = await this.findOne(id);
      await this.auditService.log({
        actorId: meta?.actorId,
        action: RolesPermissions.UPDATE_ROLES,
        targetType: 'role',
        targetId: id,
        before: { name: before.name, slug: before.slug, description: before.description },
        after: {
          name: final.name,
          slug: final.slug,
          description: final.description,
          permissionIds: dto.permissionIds,
        },
        ip: meta?.ip,
      });
      return final;
    }
    await this.auditService.log({
      actorId: meta?.actorId,
      action: RolesPermissions.UPDATE_ROLES,
      targetType: 'role',
      targetId: id,
      before: { name: before.name, slug: before.slug, description: before.description },
      after: { name: updated.name, slug: updated.slug, description: updated.description },
      ip: meta?.ip,
    });
    return updated;
  }

  async remove(id: number, meta?: ActionMeta): Promise<void> {
    const role = await this.findOne(id);
    const hasUsers = await this.roleRepository.hasUsers(id);
    if (hasUsers) {
      throw new AppException(
        ErrorCodes.RELATION_VIOLATION,
        'Cannot delete role that has users assigned to it',
        HttpStatus.CONFLICT,
      );
    }
    await this.roleRepository.delete(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: RolesPermissions.DELETE_ROLES,
      targetType: 'role',
      targetId: id,
      before: { name: role.name, slug: role.slug },
      ip: meta?.ip,
    });
  }

  async setPermissions(
    id: number,
    permissionIds: number[],
    meta?: ActionMeta,
  ): Promise<RoleWithPermissions> {
    const before = await this.findOne(id);
    const beforeIds = before.permissions?.map((rp) => rp.permission.id) ?? [];
    await this.roleRepository.setPermissions(id, permissionIds);
    const result = await this.findOne(id);
    await this.auditService.log({
      actorId: meta?.actorId,
      action: RolesPermissions.UPDATE_ROLES,
      targetType: 'role',
      targetId: id,
      before: { permissionIds: beforeIds },
      after: { permissionIds },
      ip: meta?.ip,
    });
    return result;
  }
}
