import { Controller, Post, Body, UseGuards, Get, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Response, Request } from 'express';
import { getMeta } from '@/common/helper/action-meta';
import { AuthRequest } from './interface/auth-request.interface';

@ApiTags('Auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, res, getMeta(req).ip);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refreshToken(req, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  @ApiOperation({ summary: 'Update last seen timestamp for the current user' })
  heartbeat(@Req() req: AuthRequest) {
    return this.authService.heartbeat(req.user.userId);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // @Public() means JwtAuthGuard short-circuits (see JwtAuthGuard.canActivate)
    // without ever running the JWT strategy, so req.user is never populated
    // here — that's deliberate (logout must still succeed with an already
    // expired access token), but it means we have to decode the cookie
    // ourselves to know which operator is logging out.
    const userId = this.authService.decodeUserIdFromAccessToken(req.cookies?.accessToken);
    return this.authService.logout(userId, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current admin user' })
  async me(@Req() req: AuthRequest) {
    return {
      user: await this.authService.getMe(req.user.userId),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link by email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using an emailed token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
