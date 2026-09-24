import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { WsPermissionsGuard } from './ws-permissions.guard';

function contextWithClient(
  client: unknown,
  requiredPermissions: string[] | undefined,
): {
  context: ExecutionContext;
  reflector: { getAllAndOverride: jest.Mock };
} {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions) };
  const context = {
    switchToWs: () => ({ getClient: () => client }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('WsPermissionsGuard', () => {
  it('allows through when the handler requires no permissions', () => {
    const { context, reflector } = contextWithClient({ data: {} }, undefined);
    const guard = new WsPermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when client.data.user is missing entirely', () => {
    const { context, reflector } = contextWithClient({ data: {} }, ['chat.close']);
    const guard = new WsPermissionsGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(context)).toThrow(WsException);
  });

  it('allows a user holding the wildcard permission', () => {
    const { context, reflector } = contextWithClient({ data: { user: { permissions: ['*'] } } }, [
      'chat.close',
    ]);
    const guard = new WsPermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user missing one of several required permissions', () => {
    const { context, reflector } = contextWithClient(
      { data: { user: { permissions: ['chat.view'] } } },
      ['chat.view', 'chat.close'],
    );
    const guard = new WsPermissionsGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(context)).toThrow(WsException);
  });

  it('allows a user holding every required permission', () => {
    const { context, reflector } = contextWithClient(
      { data: { user: { permissions: ['chat.view', 'chat.close'] } } },
      ['chat.view', 'chat.close'],
    );
    const guard = new WsPermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
