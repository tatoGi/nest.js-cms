import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { UsersService } from '@/modules/users/application/users.service';

// Resolves "who can I manage" from the RoleManagement table instead of a
// hardcoded role slug per controller. Adding a new manager/subordinate pair
// (e.g. sales-supervisor -> sales-member) is a data change (a new row), not
// a new controller.
@Injectable()
export class ManagedUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /** Managed role slugs for a caller holding the given role slugs. */
  async getManagedRoleSlugs(callerRoleSlugs: string[]): Promise<string[]> {
    if (callerRoleSlugs.length === 0) return [];
    const rows = await this.prisma.roleManagement.findMany({
      where: { managerRoleSlug: { in: callerRoleSlugs } },
      select: { managedRoleSlug: true },
    });
    return [...new Set(rows.map((r) => r.managedRoleSlug))];
  }

  /** Resolves managed role slugs to their current Role ids. */
  async getManagedRoles(callerRoleSlugs: string[]) {
    const managedRoleSlugs = await this.getManagedRoleSlugs(callerRoleSlugs);
    if (managedRoleSlugs.length === 0) {
      throw new AppException(
        ErrorCodes.FORBIDDEN,
        'Your role does not manage any other role.',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.prisma.role.findMany({ where: { slug: { in: managedRoleSlugs } } });
  }

  /** Picks the target role for a create call, validating client-supplied roleSlug against the allowed set. */
  resolveTargetRole(managedRoles: { id: number; slug: string }[], requestedSlug?: string) {
    if (requestedSlug) {
      const match = managedRoles.find((r) => r.slug === requestedSlug);
      if (!match) {
        throw new AppException(
          ErrorCodes.FORBIDDEN,
          `You are not permitted to create a user with role "${requestedSlug}".`,
          HttpStatus.FORBIDDEN,
        );
      }
      return match;
    }
    if (managedRoles.length === 1) return managedRoles[0];
    throw new AppException(
      ErrorCodes.VALIDATION_ERROR,
      'roleSlug is required — you manage more than one role.',
      HttpStatus.BAD_REQUEST,
    );
  }

  async assertIsManaged(userId: number, managedRoleIds: number[]) {
    const user = await this.usersService.findOne(userId);
    const isManaged = user.roles.some((ur) => managedRoleIds.includes(ur.role.id));
    if (!isManaged) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `User ${userId} is not in a role you manage`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
