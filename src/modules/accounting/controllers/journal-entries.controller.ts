import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JournalEntriesService } from '../services/journal-entries.service';
import { CreateJournalEntryDto, CreatePeriodDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class JournalEntriesController {
  constructor(private journalService: JournalEntriesService) {}

  @ApiOperation({ summary: 'Create a new journal entry' })
  @Post('journal-entries')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.journalService.create(dto, req.user?.id);
  }

  @ApiOperation({ summary: 'List journal entries with pagination' })
  @Get('journal-entries')
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.journalService.findAll(+page || 1, +limit || 20);
  }

  @ApiOperation({ summary: 'Get a single journal entry by id' })
  @Get('journal-entries/:id')
  findOne(@Param('id') id: string) {
    return this.journalService.findOne(id);
  }

  @ApiOperation({ summary: 'Void a journal entry with a reason' })
  @Post('journal-entries/:id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.journalService.void(id, reason, req.user?.id);
  }

  @ApiOperation({ summary: 'Get the trial balance report' })
  @Get('reports/trial-balance')
  getTrialBalance() {
    return this.journalService.getTrialBalance();
  }

  @ApiOperation({ summary: 'Get the profit and loss report for a date range' })
  @Get('reports/profit-and-loss')
  getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.journalService.getProfitAndLoss(startDate, endDate);
  }

  @ApiOperation({ summary: 'Create a new accounting period' })
  @Post('periods')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createPeriod(@Body() dto: CreatePeriodDto) {
    return this.journalService.createPeriod(dto);
  }

  @ApiOperation({ summary: 'List all accounting periods' })
  @Get('periods')
  getPeriods() {
    return this.journalService.getPeriods();
  }

  @ApiOperation({ summary: 'Lock an accounting period to prevent further postings' })
  @Post('periods/:id/lock')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  lockPeriod(@Param('id') id: string) {
    return this.journalService.lockPeriod(id);
  }
}
