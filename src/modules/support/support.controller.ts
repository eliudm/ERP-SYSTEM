import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, DefaultValuePipe, ParseIntPipe, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get('stats')
  getStats() { return this.service.getStats(); }

  @Get('tickets')
  listTickets(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) { return this.service.listTickets(page, limit, status); }

  @Get('tickets/:id')
  getTicket(@Param('id') id: string) { return this.service.getTicket(id); }

  @Post('tickets')
  createTicket(@Body() dto: { subject: string; category: string; priority?: string; message: string }, @Request() req: any) {
    return this.service.createTicket(dto, req.user?.id);
  }

  @Post('tickets/:id/messages')
  addMessage(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.service.addMessage(id, body.content, req.user?.id, false);
  }

  @Patch('tickets/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, body.status);
  }
}
