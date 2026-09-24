// src/modules/auth/auth.service.ts

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserNotFoundException,
  InvalidCredentialsException,
  AccountDeactivatedException,
  InvalidRefreshTokenException,
  InvalidResetTokenException,
} from '@/common/exceptions';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as ms from 'ms';
import { Response, Request } from 'express';
import { AuditService } from '@/modules/audit/audit.service';
import { AuthMailService } from './application/auth-mail.service';
import { ChatGateway } from '@/modules/chat/chat.gateway';

const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const USER_WITH_ROLES_INCLUDE = {
  avatarMedia: { select: { id: true, url: true } },
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
  userPermissions: {
    include: { permission: true },
  },
} as const;

/**
 * Compute effective permissions:
 *   role permissions + direct grants − direct revokes
 */
function computeEffectivePermissions(
  roles: { role: { permissions: { permission: { key: string } }[] } }[],
  userPermissions: { granted: boolean; permission: { key: string } }[],
): string[] {
  const keys = new Set<string>();
  for (const ur of roles) {
    for (const rp of ur.role.permissions) {
      keys.add(rp.permission.key);
    }
  }
  for (const up of userPermissions) {
    if (up.granted) keys.add(up.permission.key);
    else keys.delete(up.permission.key);
  }
  return [...keys];
}

/** Minimal role shape for JWT payload and responses. */
function mapRoles(roles: { role: { id: number; name: string; slug: string } }[]) {
  return roles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    slug: ur.role.slug,
  }));
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly authMailService: AuthMailService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  private get refreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    return secret;
  }

  private get refreshExpiresIn(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
  }

  private get accessTokenExpiresIn(): string {
    return this.configService.getOrThrow<string>('JWT_EXPIRES_IN');
  }

  private setAccessTokenCookie(res: Response, token: string): void {
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: ms(this.accessTokenExpiresIn as ms.StringValue),
    });
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: ms(this.refreshExpiresIn as ms.StringValue),
    });
  }

  /** Issue a signed refresh token JWT for the given user. */
  private signRefreshToken(userId: number): string {
    return this.jwtService.sign(
      { userId },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn as any },
    );
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto, res: Response, ip?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user || !user.isActive || user.deletedAt) {
      await this.auditService.log({
        action: 'auth.login_failed',
        targetType: 'user',
        after: { email },
        ip,
      });
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.log({
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: user.id,
        after: { email },
        ip,
      });
      throw new InvalidCredentialsException();
    }

    const permissions = computeEffectivePermissions(user.roles, user.userPermissions);
    const roles = mapRoles(user.roles);

    const payload = {
      userId: user.id,
      email: user.email,
      roles: roles.map((r) => r.slug),
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.signRefreshToken(user.id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken, lastSeen: new Date() },
    });

    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      after: { email: user.email, roles: roles.map((r) => r.slug) },
      ip,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarMedia: user.avatarMedia,
        roles,
        permissions,
      },
    };
  }

  /**
   * Get current user info
   */
  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.isActive || user.deletedAt) {
      throw new AccountDeactivatedException();
    }

    const permissions = computeEffectivePermissions(user.roles, user.userPermissions);
    const roles = mapRoles(user.roles);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarMedia: user.avatarMedia,
      roles,
      permissions,
      lastLogin: user.lastLogin,
    };
  }

  /**
   * Refresh access token using refresh token cookie.
   *
   * Rotates the refresh token on every successful use: a fresh token is
   * signed, hashed, and stored in place of the old one, and the old cookie
   * value stops matching the stored hash — so a copied/stolen refresh token
   * only works once. (Also a prerequisite for reuse-detection later: a
   * presented token that doesn't match the current hash is a theft signal.)
   */
  async refreshToken(req: Request, res: Response) {
    const token: string | undefined = req.cookies?.refreshToken;
    if (!token) {
      throw new InvalidRefreshTokenException();
    }

    let userId: number;
    try {
      const payload = this.jwtService.verify<{ userId: number }>(token, {
        secret: this.refreshSecret,
      });
      userId = payload.userId;
    } catch {
      throw new InvalidRefreshTokenException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user || !user.isActive || user.deletedAt || !user.refreshToken) {
      throw new InvalidRefreshTokenException();
    }

    const tokenMatches = await bcrypt.compare(token, user.refreshToken);
    if (!tokenMatches) {
      throw new InvalidRefreshTokenException();
    }

    const permissions = computeEffectivePermissions(user.roles, user.userPermissions);
    const roles = mapRoles(user.roles);

    const accessToken = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      roles: roles.map((r) => r.slug),
      permissions,
    });
    const newRefreshToken = this.signRefreshToken(user.id);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, newRefreshToken);

    return { ok: true };
  }

  /**
   * Heartbeat — update lastSeen for the current user
   */
  async heartbeat(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    });
  }

  // Decodes the operator id out of the accessToken cookie for the @Public()
  // logout endpoint (see AuthController.logout — JwtAuthGuard never runs the
  // JWT strategy on a public route, so req.user is never populated there).
  // ignoreExpiration: true because a logout click after the access token has
  // already expired must still identify — and log out — the right operator.
  decodeUserIdFromAccessToken(token: string | undefined): number | undefined {
    if (!token) return undefined;
    try {
      return this.jwtService.verify<{ userId: number }>(token, { ignoreExpiration: true }).userId;
    } catch {
      return undefined;
    }
  }

  /**
   * Logout — clear DB token and both auth cookies
   */
  async logout(userId: number | undefined, res: Response) {
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
      // Explicit logout — reflect offline to supervisors immediately instead
      // of waiting out the chat gateway's disconnect grace period (meant for
      // accidental drops like a frozen tab, not a deliberate sign-out).
      this.chatGateway.forceOperatorOffline(userId);
    }
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { ok: true };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user || !user.isActive || user.deletedAt) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      roles: mapRoles(user.roles).map((r) => r.slug),
      permissions: computeEffectivePermissions(user.roles, user.userPermissions),
    };
  }

  /**
   * Request a password reset link. Always resolves the same way regardless
   * of whether the email matches an account — never reveal whether an email
   * is registered (avoids account enumeration).
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user && user.isActive && !user.deletedAt) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      const cmsUrl = this.configService.get<string>('CMS_URL') || 'http://localhost:3001';
      const resetUrl = `${cmsUrl}/reset-password?token=${rawToken}`;
      // Fire-and-forget: this endpoint always responds the same way
      // regardless of mail outcome (see docstring), and a slow/unreachable
      // SMTP server (nodemailer's default connect/socket timeouts run into
      // minutes) must not hang the request — sendPasswordResetLink already
      // logs success/failure itself.
      void this.authMailService.sendPasswordResetLink(user.email, { resetUrl });
    }

    return { ok: true };
  }

  /**
   * Complete a password reset. Also clears refreshToken so every existing
   * session is signed out — standard hygiene after a credential change.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date() ||
      user.deletedAt
    ) {
      throw new InvalidResetTokenException();
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshToken: null,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.password_reset',
      targetType: 'user',
      targetId: user.id,
    });

    return { ok: true };
  }
}
