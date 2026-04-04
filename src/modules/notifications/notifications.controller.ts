import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // GET /notifications/unread
  @Get('unread')
  getUnread() {
    return this.notificationsService.getUnread();
  }

  // GET /notifications/unread-count
  @Get('unread-count')
  unreadCount() {
    return this.notificationsService.unreadCount();
  }

  // GET /notifications?page=1&limit=20
  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.notificationsService.findAll(+page || 1, +limit || 20);
  }

  // PATCH /notifications/mark-all-read
  @Patch('mark-all-read')
  markAllRead() {
    return this.notificationsService.markAllRead();
  }

  // PATCH /notifications/:id/read
  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
