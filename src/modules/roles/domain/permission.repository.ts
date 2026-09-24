import { Permission } from '@prisma/client';
import { PaginatedResult, PaginationOptions } from '@/common/pagination/pagination.type';

export interface PermissionFilters {
  search?: string;
  group?: string;
}

export interface CreatePermissionData {
  key: string;
  label: string;
  group: string;
}

export interface UpdatePermissionData {
  key?: string;
  label?: string;
  group?: string;
}

export interface IPermissionRepository {
  findAll(filters?: PermissionFilters): Promise<Permission[]>;
  findAllGrouped(): Promise<Record<string, Permission[]>>;
  findPaginated(
    filters: PermissionFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Permission>>;
  findById(id: number): Promise<Permission | null>;
  keyExists(key: string, excludeId?: number): Promise<boolean>;
  create(data: CreatePermissionData): Promise<Permission>;
  update(id: number, data: UpdatePermissionData): Promise<Permission>;
  delete(id: number): Promise<void>;
  hasRoles(id: number): Promise<boolean>;
}
