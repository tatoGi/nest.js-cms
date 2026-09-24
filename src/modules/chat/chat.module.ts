import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { MailModule } from '@/common/mail/mail.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ChatService } from './application/chat.service';
import { DmService } from './application/dm.service';
import { ChatMailService } from './application/chat-mail.service';
import { ProgramsService } from './application/programs.service';
import { RegionsService } from './application/regions.service';
import { CannedResponseService } from './application/canned-response.service';
import { ChatReportingService } from './application/chat-reporting.service';
import { OperatorRotationService } from './application/operator-rotation.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './api/chat.controller';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsPermissionsGuard } from './guards/ws-permissions.guard';

@Module({
  // forwardRef: AuthModule needs ChatGateway (to force an operator offline
  // immediately on logout, see AuthService.logout) while ChatGateway needs
  // AuthService — a genuine circular dependency between the two modules.
  imports: [PrismaModule, MailModule, forwardRef(() => AuthModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    DmService,
    ChatMailService,
    ProgramsService,
    RegionsService,
    CannedResponseService,
    ChatReportingService,
    OperatorRotationService,
    ChatGateway,
    WsAuthGuard,
    WsPermissionsGuard,
  ],
  exports: [ChatService, DmService, ChatGateway],
})
export class ChatModule {}
