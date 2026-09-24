import { User, Role, Permission } from '@prisma/client';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';

export interface RoleWithPermissions extends Role {
  permissions: { permission: Permission }[];
}

export interface UserRole {
  role: RoleWithPermissions;
}

export interface UserPermissionEntry {
  permissionId: number;
  granted: boolean;
  permission: Permission;
}

export interface UserWithRoles extends User {
  roles: UserRole[];
  userPermissions: UserPermissionEntry[];
}

export interface UserFilters {
  search?: string;
  isActive?: boolean;
  roleId?: number | number[];
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  password: string;
  roleIds: number[];
  avatarMediaId?: number | null;
  isActive?: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  roleIds?: number[];
  avatarMediaId?: number | null;
  isActive?: boolean;
}

export interface IUserRepository {
  findAll(filters?: UserFilters): Promise<UserWithRoles[]>;
  findPaginated(
    filters: UserFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<UserWithRoles>>;
  findTrashedPaginated(
    filters: UserFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<UserWithRoles>>;
  findById(id: number): Promise<UserWithRoles | null>;
  findByEmail(email: string): Promise<UserWithRoles | null>;
  emailExists(email: string, excludeId?: number): Promise<boolean>;
  create(data: CreateUserData): Promise<UserWithRoles>;
  update(id: number, data: UpdateUserData): Promise<UserWithRoles>;
  updatePassword(id: number, hashedPassword: string): Promise<void>;
  softDelete(id: number): Promise<void>;
  restore(id: number): Promise<void>;
  hardDelete(id: number): Promise<void>;
  setPermission(userId: number, permissionId: number, granted: boolean): Promise<void>;
  removePermission(userId: number, permissionId: number): Promise<void>;
}
