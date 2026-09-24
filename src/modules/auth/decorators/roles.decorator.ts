// src/modules/auth/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to require specific roles
 *
 * @example
 * @RequireRoles('admin', 'editor')
 * async deleteUser() { }
 */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
