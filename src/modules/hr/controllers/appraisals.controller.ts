import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AppraisalsService } from '../services/appraisals.service';

@UseGuards(JwtAuthGuard)
@Controller('hr/appraisals')
export class AppraisalsController {
  constructor(private readonly appraisalsService: AppraisalsService) {}

  @Post()
  create(
    @Body()
    body: {
      employeeId: string;
      reviewerId: string;
      period: string;
      criteria?: { name: string; weight?: number }[];
    },
  ) {
    return this.appraisalsService.create(body);
  }

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.appraisalsService.findAll(employeeId, period, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appraisalsService.findOne(id);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() body: { name: string; target?: string; weight?: number },
  ) {
    return this.appraisalsService.addItem(id, body);
  }

  @Patch(':appraisalId/items/:itemId/score')
  scoreItem(
    @Param('appraisalId') appraisalId: string,
    @Param('itemId') itemId: string,
    @Body() body: { score: number; achievement?: string },
  ) {
    return this.appraisalsService.scoreItem(
      appraisalId,
      itemId,
      body.score,
      body.achievement,
    );
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.appraisalsService.submit(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { comments?: string }) {
    return this.appraisalsService.approve(id, body.comments);
  }
}
