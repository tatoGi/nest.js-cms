import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IUserRepository, UserWithRoles } from '../domain/user.repository';
import { CreateUserDto, UpdateUserDto, UserPaginatedQueryDto, SetUserPermissionDto } from '../dto';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import { UserNotFoundException } from '@/common/exceptions';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCodes } from '@/common/exceptions/error-codes';
import { HttpStatus } from '@nestjs/common';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/application/notifications.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ActionMeta } from '@/common/helper/action-meta';
import { UsersPermissions } from './users.permissions';

@Injectable()
export class UsersService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async findAllPaginated(
    query: UserPaginatedQueryDto,
    forcedRoleId?: number | number[],
  ): Promise<PaginatedResponseDto<Omit<UserWithRoles, 'password'>>> {
    const result = await this.userRepository.findPaginated(
      { search: query.search, isActive: query.isActive, roleId: forcedRoleId },
      { page: query.page ?? 1, limit: query.limit ?? 10 },
    );
    const sanitized = result.data.map(this.sanitize);
    return new PaginatedResponseDto(
      sanitized,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async findOne(id: number): Promise<Omit<UserWithRoles, 'password'>> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new UserNotFoundException(id);
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto, meta?: ActionMeta): Promise<Omit<UserWithRoles, 'password'>> {
    const emailTaken = await this.userRepository.emailExists(dto.email);
    if (emailTaken) {
      throw new AppException(
        ErrorCodes.UNIQUE_CONSTRAINT,
        `Email "${dto.email}" is already in use`,
        HttpStatus.CONFLICT,
      );
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const displayName = dto.displayName?.trim() || `${dto.firstName} ${dto.lastName}`.trim();
    const user = await this.userRepository.create({
      ...dto,
      displayName,
      password: hashedPassword,
    });
    const sanitized = this.sanitize(user);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.CREATE_USERS,
      targetType: 'user',
      targetId: user.id,
      after: { displayName: user.displayName, email: user.email },
      ip: meta?.ip,
    });

    await this.notificationsService.create({
      type: 'user.created',
      title: 'New user added',
      message: `${user.displayName} (${user.email}) was added to the system.`,
      link: `/users`,
      actorId: meta?.actorId,
    });

    return sanitized;
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    meta?: ActionMeta,
  ): Promise<Omit<UserWithRoles, 'password'>> {
    const existing = await this.findOne(id);
    if (dto.email) {
      const emailTaken = await this.userRepository.emailExists(dto.email, id);
      if (emailTaken) {
        throw new AppException(
          ErrorCodes.UNIQUE_CONSTRAINT,
          `Email "${dto.email}" is already in use`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const user = await this.userRepository.update(id, dto);

    // If roles changed, invalidate session so new permissions take effect on next login
    if (dto.roleIds) {
      await this.prisma.user.update({ where: { id }, data: { refreshToken: null } });
    }

    const sanitized = this.sanitize(user);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.UPDATE_USERS,
      targetType: 'user',
      targetId: id,
      before: {
        displayName: existing.displayName,
        email: existing.email,
        isActive: existing.isActive,
      },
      after: { displayName: user.displayName, email: user.email, isActive: user.isActive },
      ip: meta?.ip,
    });

    return sanitized;
  }

  async changePassword(id: number, password: string, meta?: ActionMeta): Promise<void> {
    await this.findOne(id);
    const hashed = await bcrypt.hash(password, 10);
    await this.userRepository.updatePassword(id, hashed);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.UPDATE_USERS,
      targetType: 'user',
      targetId: id,
      ip: meta?.ip,
    });
  }

  async findTrashedPaginated(
    query: UserPaginatedQueryDto,
    forcedRoleId?: number | number[],
  ): Promise<PaginatedResponseDto<Omit<UserWithRoles, 'password'>>> {
    const result = await this.userRepository.findTrashedPaginated(
      { search: query.search, roleId: forcedRoleId },
      { page: query.page ?? 1, limit: query.limit ?? 10 },
    );
    const sanitized = result.data.map(this.sanitize);
    return new PaginatedResponseDto(
      sanitized,
      result.total,
      result.page,
      result.limit,
      result.totalPages,
    );
  }

  async softDelete(id: number, meta?: ActionMeta): Promise<void> {
    const existing = await this.findOne(id);
    await this.userRepository.softDelete(id);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.DELETE_USERS,
      targetType: 'user',
      targetId: id,
      before: { displayName: existing.displayName, email: existing.email },
      ip: meta?.ip,
    });

    await this.notificationsService.create({
      type: 'user.deleted',
      title: 'User moved to trash',
      message: `${existing.displayName} (${existing.email}) was moved to trash.`,
      actorId: meta?.actorId,
    });
  }

  async restore(id: number, meta?: ActionMeta): Promise<void> {
    await this.userRepository.restore(id);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.UPDATE_USERS,
      targetType: 'user',
      targetId: id,
      ip: meta?.ip,
    });
  }

  async hardDelete(id: number, meta?: ActionMeta): Promise<void> {
    const existing = await this.findOne(id);
    await this.userRepository.hardDelete(id);

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.DELETE_USERS,
      targetType: 'user',
      targetId: id,
      before: { displayName: existing.displayName, email: existing.email },
      ip: meta?.ip,
    });

    await this.notificationsService.create({
      type: 'user.deleted',
      title: 'User permanently deleted',
      message: `${existing.displayName} (${existing.email}) was permanently deleted.`,
      actorId: meta?.actorId,
    });
  }

  // ─── Direct permissions ──────────────────────────────────────

  async getUserPermissions(userId: number) {
    await this.findOne(userId);

    const allPermissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    const user = await this.userRepository.findById(userId);

    // Collect role permission keys
    const fromRoles = new Set<string>();
    const roleNames: Record<string, string[]> = {};
    for (const ur of user!.roles) {
      for (const rp of ur.role.permissions) {
        fromRoles.add(rp.permission.key);
        if (!roleNames[rp.permission.key]) roleNames[rp.permission.key] = [];
        roleNames[rp.permission.key].push(ur.role.name);
      }
    }

    // Direct overrides map
    const directMap = new Map<number, boolean>();
    for (const up of user!.userPermissions) {
      directMap.set(up.permissionId, up.granted);
    }

    return allPermissions.map((p) => {
      const direct = directMap.has(p.id) ? directMap.get(p.id) : undefined;
      const inRole = fromRoles.has(p.key);

      let effectiveGranted: boolean;
      if (direct === false) effectiveGranted = false;
      else if (direct === true) effectiveGranted = true;
      else effectiveGranted = inRole;

      return {
        id: p.id,
        key: p.key,
        label: p.label,
        group: p.group,
        inRole,
        roleNames: roleNames[p.key] ?? [],
        direct: direct !== undefined ? { granted: direct } : null,
        effectiveGranted,
      };
    });
  }

  async setPermission(userId: number, dto: SetUserPermissionDto, meta?: ActionMeta): Promise<void> {
    await this.findOne(userId);
    const permission = await this.prisma.permission.findUnique({ where: { id: dto.permissionId } });
    if (!permission) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Permission ${dto.permissionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.userRepository.setPermission(userId, dto.permissionId, dto.granted);

    // Invalidate existing session so new permissions take effect on next login
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });

    await this.auditService.log({
      actorId: meta?.actorId,
      action: dto.granted ? 'user.permission.granted' : 'user.permission.revoked',
      targetType: 'user',
      targetId: userId,
      after: {
        permissionId: dto.permissionId,
        permissionKey: permission.key,
        granted: dto.granted,
      },
      ip: meta?.ip,
    });
  }

  async removePermission(userId: number, permissionId: number, meta?: ActionMeta): Promise<void> {
    await this.findOne(userId);
    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });

    await this.userRepository.removePermission(userId, permissionId);

    // Invalidate existing session so new permissions take effect on next login
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });

    await this.auditService.log({
      actorId: meta?.actorId,
      action: UsersPermissions.UPDATE_USERS,
      targetType: 'user',
      targetId: userId,
      after: { permissionId, permissionKey: permission?.key },
      ip: meta?.ip,
    });
  }

  private sanitize(user: UserWithRoles): Omit<UserWithRoles, 'password'> & { isOnline: boolean } {
    const { password: _password, ...rest } = user;
    const isOnline = !!user.lastSeen && Date.now() - user.lastSeen.getTime() < 3 * 60 * 1000;
    return { ...rest, isOnline };
  }
}
