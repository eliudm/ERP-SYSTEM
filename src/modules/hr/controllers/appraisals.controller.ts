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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AppraisalsService } from '../services/appraisals.service';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/appraisals')
export class AppraisalsController {
  constructor(private readonly appraisalsService: AppraisalsService) {}

  @ApiOperation({ summary: 'Create a new performance appraisal' })
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

  @ApiOperation({ summary: 'List appraisals, optionally filtered by employee, period, or status' })
  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.appraisalsService.findAll(employeeId, period, status);
  }

  @ApiOperation({ summary: 'Get a single appraisal by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appraisalsService.findOne(id);
  }

  @ApiOperation({ summary: 'Add a scoring item to an appraisal' })
  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() body: { name: string; target?: string; weight?: number },
  ) {
    return this.appraisalsService.addItem(id, body);
  }

  @ApiOperation({ summary: 'Record a score and achievement for an appraisal item' })
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

  @ApiOperation({ summary: 'Submit an appraisal for approval' })
  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.appraisalsService.submit(id);
  }

  @ApiOperation({ summary: 'Approve an appraisal with optional comments' })
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { comments?: string }) {
    return this.appraisalsService.approve(id, body.comments);
  }
}
