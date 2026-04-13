import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

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

  // POST /notifications/reminders/overdue-invoices?daysOverdue=0
  @Post('reminders/overdue-invoices')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  sendOverdueReminders(@Query('daysOverdue') daysOverdue: string) {
    return this.notificationsService.sendOverdueInvoiceReminders(
      Number(daysOverdue) || 0,
    );
  }
}
