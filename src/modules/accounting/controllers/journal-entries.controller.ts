import {
	Controller, Get, Post, Body,
	Param, Query, UseGuards,
} from '@nestjs/common';
import { JournalEntriesService } from '../services/journal-entries.service';
import { CreateJournalEntryDto, CreatePeriodDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('accounting')
export class JournalEntriesController {
	constructor(private journalService: JournalEntriesService) {}

	@Post('journal-entries')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	create(@Body() dto: CreateJournalEntryDto) {
		return this.journalService.create(dto);
	}

	@Get('journal-entries')
	findAll(
		@Query('page') page: string,
		@Query('limit') limit: string,
	) {
		return this.journalService.findAll(+page || 1, +limit || 20);
	}

	@Get('journal-entries/:id')
	findOne(@Param('id') id: string) {
		return this.journalService.findOne(id);
	}

	@Post('journal-entries/:id/void')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	void(@Param('id') id: string, @Body('reason') reason: string) {
		return this.journalService.void(id, reason);
	}

	@Get('reports/trial-balance')
	getTrialBalance() {
		return this.journalService.getTrialBalance();
	}

	@Get('reports/profit-and-loss')
	getProfitAndLoss(
		@Query('startDate') startDate: string,
		@Query('endDate') endDate: string,
	) {
		return this.journalService.getProfitAndLoss(startDate, endDate);
	}

	@Post('periods')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	createPeriod(@Body() dto: CreatePeriodDto) {
		return this.journalService.createPeriod(dto);
	}

	@Get('periods')
	getPeriods() {
		return this.journalService.getPeriods();
	}

	@Post('periods/:id/lock')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN)
	lockPeriod(@Param('id') id: string) {
		return this.journalService.lockPeriod(id);
	}
}
