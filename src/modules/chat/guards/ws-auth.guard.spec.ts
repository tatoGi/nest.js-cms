import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsAuthGuard } from './ws-auth.guard';

function contextWithClient(client: unknown): ExecutionContext {
  return {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ExecutionContext;
}

describe('WsAuthGuard', () => {
  const guard = new WsAuthGuard();

  it('allows a socket whose client.data.user was populated at connection time', () => {
    const context = contextWithClient({ data: { user: { userId: 1 } } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an anonymous socket (no client.data.user)', () => {
    const context = contextWithClient({ data: {} });
    expect(() => guard.canActivate(context)).toThrow(WsException);
  });

  it('rejects a socket with no data object at all', () => {
    const context = contextWithClient({});
    expect(() => guard.canActivate(context)).toThrow(WsException);
  });
});
