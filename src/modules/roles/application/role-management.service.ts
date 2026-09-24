import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { AuditService } from '@/modules/audit/audit.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { CreateRoleManagementDto } from '../dto/create-role-management.dto';

const ROLE_MANAGEMENT_INCLUDE = {
  managerRole: { select: { id: true, name: true, slug: true } },
  managedRole: { select: { id: true, name: true, slug: true } },
} as const;

// Admin-facing CRUD over the RoleManagement table — the same data the
// generic ManagedUsersController reads from. This is what lets an Admin add
// a new manager/subordinate pairing (e.g. sales-supervisor -> sales-member)
// from the CMS instead of editing a seed script.
@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.roleManagement.findMany({
      include: ROLE_MANAGEMENT_INCLUDE,
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateRoleManagementDto, meta?: ActionMeta) {
    if (dto.managerRoleSlug === dto.managedRoleSlug) {
      throw new AppException(
        ErrorCodes.VALIDATION_ERROR,
        'A role cannot manage itself',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [managerRole, managedRole] = await Promise.all([
      this.prisma.role.findUnique({ where: { slug: dto.managerRoleSlug } }),
      this.prisma.role.findUnique({ where: { slug: dto.managedRoleSlug } }),
    ]);
    if (!managerRole) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Role "${dto.managerRoleSlug}" does not exist`,
        HttpStatus.NOT_FOUND,
      );
    }
    if (!managedRole) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Role "${dto.managedRoleSlug}" does not exist`,
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.roleManagement.findUnique({
      where: {
        managerRoleSlug_managedRoleSlug: {
          managerRoleSlug: dto.managerRoleSlug,
          managedRoleSlug: dto.managedRoleSlug,
        },
      },
    });
    if (existing) {
      throw new AppException(
        ErrorCodes.UNIQUE_CONSTRAINT,
        `"${managerRole.name}" already manages "${managedRole.name}"`,
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.roleManagement.create({
      data: { managerRoleSlug: dto.managerRoleSlug, managedRoleSlug: dto.managedRoleSlug },
      include: ROLE_MANAGEMENT_INCLUDE,
    });

    await this.auditService.log({
      actorId: meta?.actorId,
      action: 'role_management.created',
      targetType: 'role_management',
      targetId: row.id,
      after: { managerRoleSlug: row.managerRoleSlug, managedRoleSlug: row.managedRoleSlug },
      ip: meta?.ip,
    });

    return row;
  }

  async remove(id: number, meta?: ActionMeta) {
    const row = await this.prisma.roleManagement.findUnique({
      where: { id },
      include: ROLE_MANAGEMENT_INCLUDE,
    });
    if (!row) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Role management pairing ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.roleManagement.delete({ where: { id } });

    await this.auditService.log({
      actorId: meta?.actorId,
      action: 'role_management.deleted',
      targetType: 'role_management',
      targetId: id,
      before: { managerRoleSlug: row.managerRoleSlug, managedRoleSlug: row.managedRoleSlug },
      ip: meta?.ip,
    });
  }
}
