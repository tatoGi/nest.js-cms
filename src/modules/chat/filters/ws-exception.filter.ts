import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { CHAT_EVENTS } from '../chat-events.constants';
import { AuthenticatedSocket } from '../chat-socket.types';

// Normalizes a thrown WsException (from WsAuthGuard/WsPermissionsGuard, or
// any handler that throws one directly) into the same chat:error /
// chat:permission_error client-emit shape the gateway's try/catch blocks
// already use ad hoc — so an unauthorized/forbidden socket call fails the
// same way from the frontend's point of view as any other handled error,
// instead of Nest's default (silently dropping the response).
@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  override catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<AuthenticatedSocket>();
    const message = exception.message || 'Unauthorized';
    const event = message.startsWith('Insufficient permissions')
      ? CHAT_EVENTS.CHAT_PERMISSION_ERROR
      : CHAT_EVENTS.CHAT_ERROR;
    client.emit(event, { message });
  }
}
