import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { User } from '@prisma/client';
import {
  IUserRepository,
  UserFilters,
  UserWithRoles,
  CreateUserData,
  UpdateUserData,
} from '../domain/user.repository';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';

const USER_INCLUDE = {
  avatarMedia: { select: { id: true, url: true } },
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
  userPermissions: {
    include: { permission: true },
  },
} as const;

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters?: UserFilters) {
    const where: any = { deletedAt: null };
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.roleId !== undefined) {
      const roleId = Array.isArray(filters.roleId) ? { in: filters.roleId } : filters.roleId;
      where.roles = { some: { roleId } };
    }
    return where;
  }

  async findAll(filters?: UserFilters): Promise<UserWithRoles[]> {
    return this.prisma.user.findMany({
      where: this.buildWhere(filters),
      include: USER_INCLUDE,
      orderBy: { displayName: 'asc' },
    }) as Promise<UserWithRoles[]>;
  }

  async findPaginated(
    filters: UserFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<UserWithRoles>> {
    const where = this.buildWhere(filters);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const result = await prismaPaginate<User>(
      this.prisma.user,
      { where, include: USER_INCLUDE, orderBy: { displayName: 'asc' } },
      { page, limit, skip },
    );

    return result as PaginatedResult<UserWithRoles>;
  }

  async findTrashedPaginated(
    filters: UserFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<UserWithRoles>> {
    const where: any = { deletedAt: { not: null } };
    if (filters?.roleId !== undefined) {
      const roleId = Array.isArray(filters.roleId) ? { in: filters.roleId } : filters.roleId;
      where.roles = { some: { roleId } };
    }
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const result = await prismaPaginate<User>(
      this.prisma.user,
      { where, include: USER_INCLUDE, orderBy: { deletedAt: 'desc' } },
      { page, limit, skip },
    );

    return result as PaginatedResult<UserWithRoles>;
  }

  async findById(id: number): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    }) as Promise<UserWithRoles | null>;
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    }) as Promise<UserWithRoles | null>;
  }

  async emailExists(email: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email, ...(excludeId && { id: { not: excludeId } }) },
    });
    return count > 0;
  }

  async create(data: CreateUserData): Promise<UserWithRoles> {
    return this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        avatarMediaId: data.avatarMediaId ?? null,
        isActive: data.isActive ?? true,
        roles: {
          create: data.roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: USER_INCLUDE,
    }) as Promise<UserWithRoles>;
  }

  async update(id: number, data: UpdateUserData): Promise<UserWithRoles> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.avatarMediaId !== undefined && { avatarMediaId: data.avatarMediaId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.roleIds !== undefined && {
          roles: {
            deleteMany: {},
            create: data.roleIds.map((roleId) => ({ roleId })),
          },
        }),
      },
      include: USER_INCLUDE,
    }) as Promise<UserWithRoles>;
  }

  async updatePassword(id: number, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: number): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { deletedAt: null } });
  }

  async hardDelete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async setPermission(userId: number, permissionId: number, granted: boolean): Promise<void> {
    await this.prisma.userPermission.upsert({
      where: { userId_permissionId: { userId, permissionId } },
      update: { granted },
      create: { userId, permissionId, granted },
    });
  }

  async removePermission(userId: number, permissionId: number): Promise<void> {
    await this.prisma.userPermission.deleteMany({
      where: { userId, permissionId },
    });
  }
}
