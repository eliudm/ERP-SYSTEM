import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PosSessionsService } from '../services/pos-sessions.service';
import { OpenPosSessionDto } from '../dto/open-pos-session.dto';
import { ClosePosSessionDto } from '../dto/close-pos-session.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

// Mounted under /sales/ so JwtAuthGuard's existing posOnly allowlist (which
// already permits the whole /api/v1/sales/* prefix) covers these routes
// with no guard changes needed — cashiers need to open/close their own
// register same as they need every other sales endpoint.
@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/pos-sessions')
export class PosSessionsController {
  constructor(private posSessionsService: PosSessionsService) {}

  @ApiOperation({ summary: "Open (or resume) the current user's POS session" })
  @Post('open')
  open(@Body() dto: OpenPosSessionDto, @Req() req: any) {
    return this.posSessionsService.openSession(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Close a POS session, recording the reconciliation note/counts',
  })
  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: ClosePosSessionDto) {
    return this.posSessionsService.closeSession(id, dto);
  }

  @ApiOperation({ summary: "Get the current user's open POS session, if any" })
  @Get('current')
  current(@Req() req: any) {
    return this.posSessionsService.getCurrentSession(req.user.id);
  }
}
