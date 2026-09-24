import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { PrismaRoleRepository } from './infrastructure/prisma-role.repository';
import { PrismaPermissionRepository } from './infrastructure/prisma-permission.repository';
import { RolesService } from './application/roles.service';
import { PermissionsService } from './application/permissions.service';
import { RoleManagementService } from './application/role-management.service';
import { AdminRolesController } from './api/controllers/admin-roles.controller';
import { AdminPermissionsController } from './api/controllers/admin-permissions.controller';
import { AdminRoleManagementController } from './api/controllers/admin-role-management.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminRolesController, AdminPermissionsController, AdminRoleManagementController],
  providers: [
    RolesService,
    {
      provide: 'IRoleRepository',
      useClass: PrismaRoleRepository,
    },
    PermissionsService,
    {
      provide: 'IPermissionRepository',
      useClass: PrismaPermissionRepository,
    },
    RoleManagementService,
  ],
  exports: [RolesService, PermissionsService],
})
export class RolesModule {}
