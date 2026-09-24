import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AuthMailService } from './application/auth-mail.service';
import { AuthService } from './auth.service';
import { InvalidRefreshTokenException } from '@/common/exceptions';

describe('AuthService — refreshToken rotation', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let signCounter: number;

  const REFRESH_SECRET = 'test-refresh-secret';
  const user = {
    id: 1,
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    isActive: true,
    deletedAt: null,
    refreshToken: null as string | null,
    roles: [],
    userPermissions: [],
  };

  function makeRes() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
  }

  function makeReq(refreshToken: string) {
    return { cookies: { refreshToken } } as any;
  }

  beforeEach(async () => {
    user.refreshToken = null;
    signCounter = 0;

    prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(user)),
        update: jest.fn().mockImplementation(({ data }) => {
          Object.assign(user, data);
          return Promise.resolve(user);
        }),
      },
    };

    jwtService = {
      // Real JWTs are unique per call (iat/jti) — mirror that with a counter
      // so rotation can't be masked by two same-payload signs producing an
      // identical string.
      sign: jest.fn().mockImplementation((payload: any, opts?: any) => {
        return JSON.stringify({ payload, secret: opts?.secret ?? 'access', nonce: signCounter++ });
      }),
      verify: jest.fn().mockImplementation((token: string, opts?: any) => {
        const parsed = JSON.parse(token);
        if (parsed.secret !== (opts?.secret ?? 'access')) {
          throw new Error('bad secret');
        }
        return parsed.payload;
      }),
    };

    const configService = {
      get: jest.fn().mockReturnValue(REFRESH_SECRET),
      getOrThrow: jest.fn().mockReturnValue('30d'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: AuthMailService, useValue: { sendPasswordResetLink: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);

    // Seed a stored (hashed) refresh token as if the user had already logged in.
    const initialToken = jwtService.sign({ userId: user.id }, { secret: REFRESH_SECRET });
    user.refreshToken = await bcrypt.hash(initialToken, 10);
    (user as any).__initialToken = initialToken;
  });

  it('issues and stores a new refresh token on every successful refresh, distinct from the old one', async () => {
    const oldToken = (user as any).__initialToken as string;
    const oldHash = user.refreshToken;

    const res = makeRes();
    const result = await service.refreshToken(makeReq(oldToken), res);

    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: user.id } }),
    );
    // Stored hash changed — rotation happened, not just an access-token reissue.
    expect(user.refreshToken).not.toEqual(oldHash);

    // New refresh cookie was set with a token different from the old one.
    const refreshCookieCall = res.cookie.mock.calls.find((c: any[]) => c[0] === 'refreshToken');
    expect(refreshCookieCall).toBeDefined();
    const newToken = refreshCookieCall[1];
    expect(newToken).not.toEqual(oldToken);
    expect(await bcrypt.compare(newToken, user.refreshToken as string)).toBe(true);

    // Cookie flags mirror the login cookie mechanism.
    expect(refreshCookieCall[2]).toEqual(
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );

    // Access token cookie was also refreshed.
    expect(res.cookie).toHaveBeenCalledWith(
      'accessToken',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects reuse of a refresh token after it has been rotated out', async () => {
    const oldToken = (user as any).__initialToken as string;

    // First refresh rotates the stored token.
    await service.refreshToken(makeReq(oldToken), makeRes());

    // Reusing the now-stale token must fail.
    await expect(service.refreshToken(makeReq(oldToken), makeRes())).rejects.toThrow(
      InvalidRefreshTokenException,
    );
  });

  it('supports login → refresh → refresh again end-to-end', async () => {
    const firstToken = (user as any).__initialToken as string;

    const res1 = makeRes();
    await service.refreshToken(makeReq(firstToken), res1);
    const secondToken = res1.cookie.mock.calls.find((c: any[]) => c[0] === 'refreshToken')[1];

    const res2 = makeRes();
    const result = await service.refreshToken(makeReq(secondToken), res2);

    expect(result).toEqual({ ok: true });
    const thirdToken = res2.cookie.mock.calls.find((c: any[]) => c[0] === 'refreshToken')[1];
    expect(thirdToken).not.toEqual(secondToken);
  });
});
