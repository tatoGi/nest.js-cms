import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '@/common/guards/permissions.guard';
import { AuthenticatedSocket } from '../chat-socket.types';

// WS analogue of the REST PermissionsGuard (src/common/guards/permissions.guard.ts)
// — same @RequirePermissions(...) metadata, same '*' wildcard, same
// all-required semantics, just reading from the WS execution context and
// throwing WsException instead of ForbiddenException. Always pair with
// @UseGuards(WsAuthGuard, WsPermissionsGuard) — this guard assumes
// client.data.user is already populated and does not check for its absence.
@Injectable()
export class WsPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const user = client.data?.user;
    if (!user) throw new WsException('Unauthorized');

    if (user.permissions.includes('*')) return true;

    const hasAllPermissions = requiredPermissions.every((p) => user.permissions.includes(p));
    if (!hasAllPermissions) {
      throw new WsException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }
    return true;
  }
}
