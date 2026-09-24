// src/modules/auth/guards/roles.guard.ts

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();

    // User not authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // User has no roles
    if (!user.roles?.length) {
      throw new ForbiddenException('User has no role assigned');
    }

    // Check if user has at least one of the required roles
    const hasRole = requiredRoles.some((r) => user.roles.includes(r));

    if (!hasRole) {
      throw new ForbiddenException(`Required role: ${requiredRoles.join(' or ')}`);
    }

    return true;
  }
}
