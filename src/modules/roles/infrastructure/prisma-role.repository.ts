import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Role } from '@prisma/client';
import {
  IRoleRepository,
  RoleFilters,
  RoleWithPermissions,
  CreateRoleData,
  UpdateRoleData,
} from '../domain/role.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';

const ROLE_INCLUDE = {
  permissions: {
    include: { permission: true },
  },
} as const;

@Injectable()
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters?: RoleFilters) {
    if (!filters?.search) return {};
    return {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' as const } },
        { slug: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    };
  }

  async findAll(filters?: RoleFilters): Promise<RoleWithPermissions[]> {
    return this.prisma.role.findMany({
      where: this.buildWhere(filters),
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    }) as Promise<RoleWithPermissions[]>;
  }

  async findPaginated(
    filters: RoleFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<RoleWithPermissions>> {
    const where = this.buildWhere(filters);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const result = await prismaPaginate<Role>(
      this.prisma.role,
      { where, include: ROLE_INCLUDE, orderBy: { name: 'asc' } },
      { page, limit, skip },
    );

    return result as PaginatedResult<RoleWithPermissions>;
  }

  async findById(id: number): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    }) as Promise<RoleWithPermissions | null>;
  }

  async findBySlug(slug: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { slug },
      include: ROLE_INCLUDE,
    }) as Promise<RoleWithPermissions | null>;
  }

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.role.count({
      where: { slug, ...(excludeId && { id: { not: excludeId } }) },
    });
    return count > 0;
  }

  async create(data: CreateRoleData): Promise<RoleWithPermissions> {
    return this.prisma.role.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        ...(data.permissionIds?.length && {
          permissions: {
            create: data.permissionIds.map((permissionId) => ({ permissionId })),
          },
        }),
      },
      include: ROLE_INCLUDE,
    }) as Promise<RoleWithPermissions>;
  }

  async update(id: number, data: UpdateRoleData): Promise<RoleWithPermissions> {
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: ROLE_INCLUDE,
    }) as Promise<RoleWithPermissions>;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  async setPermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length
        ? [
            this.prisma.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
            }),
          ]
        : []),
    ]);
  }

  async hasUsers(id: number): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { roles: { some: { roleId: id } } } });
    return count > 0;
  }
}
