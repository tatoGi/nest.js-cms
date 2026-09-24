import { Controller, Get, Post, Req, Query } from '@nestjs/common';
import { NotificationsService } from '../application/notifications.service';

@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async findAll(@Req() req: any, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.service.findAll(req.user.userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
    });
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const count = await this.service.getUnreadCount(req.user.userId);
    return { count };
  }

  @Post('mark-all-read')
  async markAllRead(@Req() req: any) {
    await this.service.markAllRead(req.user.userId);
    return { ok: true };
  }
}
