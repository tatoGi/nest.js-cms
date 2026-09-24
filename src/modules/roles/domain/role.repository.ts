import { Role, Permission } from '@prisma/client';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';

export interface RoleWithPermissions extends Role {
  permissions: Array<{ permission: Permission }>;
}

export interface RoleFilters {
  search?: string;
}

export interface CreateRoleData {
  name: string;
  slug: string;
  description?: string;
  permissionIds?: number[];
}

export interface UpdateRoleData {
  name?: string;
  slug?: string;
  description?: string;
  permissionIds?: number[];
}

export interface IRoleRepository {
  findAll(filters?: RoleFilters): Promise<RoleWithPermissions[]>;
  findPaginated(
    filters: RoleFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<RoleWithPermissions>>;
  findById(id: number): Promise<RoleWithPermissions | null>;
  findBySlug(slug: string): Promise<RoleWithPermissions | null>;
  slugExists(slug: string, excludeId?: number): Promise<boolean>;
  create(data: CreateRoleData): Promise<RoleWithPermissions>;
  update(id: number, data: UpdateRoleData): Promise<RoleWithPermissions>;
  delete(id: number): Promise<void>;
  setPermissions(roleId: number, permissionIds: number[]): Promise<void>;
  hasUsers(id: number): Promise<boolean>;
}
