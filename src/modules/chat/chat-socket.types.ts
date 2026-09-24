import { Socket } from 'socket.io';
import { JwtUser } from '@/modules/auth/interface/jwt-user.interface';

// Populated once, at handshake time, by ChatGateway.handleConnection —
// verified from the same httpOnly `accessToken` cookie/JWT the REST API
// trusts (see JwtStrategy), never from anything the client sends inside an
// individual message payload. `undefined` for anonymous (visitor) sockets —
// that's expected, not an error; only operator/DM handlers require it (see
// WsAuthGuard).
export interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtUser;
  };
}
