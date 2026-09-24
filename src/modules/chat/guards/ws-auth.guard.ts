import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthenticatedSocket } from '../chat-socket.types';

// WS analogue of JwtAuthGuard, but doesn't re-verify the JWT per message —
// ChatGateway.handleConnection already did that once at handshake time and
// stashed the result on client.data.user. This guard just enforces that a
// given @SubscribeMessage handler requires that identity to be present,
// applied per-handler (operator/DM handlers only) rather than gateway-wide,
// since visitor handlers must stay reachable by anonymous sockets.
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    if (!client.data?.user) {
      throw new WsException('Unauthorized');
    }
    return true;
  }
}
