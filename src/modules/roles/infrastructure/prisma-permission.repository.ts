import { Injectable } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  IPermissionRepository,
  PermissionFilters,
  CreatePermissionData,
  UpdatePermissionData,
} from '../domain/permission.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';

@Injectable()
export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters?: PermissionFilters) {
    const conditions: any[] = [];
    if (filters?.search) {
      conditions.push({
        OR: [
          { key: { contains: filters.search, mode: 'insensitive' as const } },
          { label: { contains: filters.search, mode: 'insensitive' as const } },
          { group: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      });
    }
    if (filters?.group) {
      conditions.push({ group: filters.group });
    }
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  async findAll(filters?: PermissionFilters): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: this.buildWhere(filters),
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });
  }

  async findAllGrouped(): Promise<Record<string, Permission[]>> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });
    const grouped: Record<string, Permission[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.group]) grouped[perm.group] = [];
      grouped[perm.group].push(perm);
    }
    return grouped;
  }

  async findPaginated(
    filters: PermissionFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Permission>> {
    const where = this.buildWhere(filters);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    return prismaPaginate<Permission>(
      this.prisma.permission,
      { where, orderBy: [{ group: 'asc' }, { label: 'asc' }] },
      { page, limit, skip },
    );
  }

  async findById(id: number): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  async keyExists(key: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: { key, ...(excludeId && { id: { not: excludeId } }) },
    });
    return count > 0;
  }

  async create(data: CreatePermissionData): Promise<Permission> {
    return this.prisma.permission.create({ data });
  }

  async update(id: number, data: UpdatePermissionData): Promise<Permission> {
    return this.prisma.permission.update({
      where: { id },
      data: {
        ...(data.key !== undefined && { key: data.key }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.group !== undefined && { group: data.group }),
      },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.permission.delete({ where: { id } });
  }

  async hasRoles(id: number): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({ where: { permissionId: id } });
    return count > 0;
  }
}
