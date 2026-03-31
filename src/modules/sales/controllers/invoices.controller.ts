import {
	Controller, Get, Post, Patch,
	Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { InvoicesService } from '../services/invoices.service';
import { CreateInvoiceDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('sales/invoices')
export class InvoicesController {
	constructor(private invoicesService: InvoicesService) {}

	// POST /sales/invoices
	@Post()
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.SALES_USER)
	create(@Body() dto: CreateInvoiceDto) {
		return this.invoicesService.create(dto);
	}

	// GET /sales/invoices
	@Get()
	findAll(
		@Query('page') page: string,
		@Query('limit') limit: string,
		@Query('status') status: string,
	) {
		return this.invoicesService.findAll(+page || 1, +limit || 20, status);
	}

	// GET /sales/invoices/summary
	@Get('summary')
	getSummary(
		@Query('startDate') startDate: string,
		@Query('endDate') endDate: string,
	) {
		return this.invoicesService.getSalesSummary(startDate, endDate);
	}

	// GET /sales/invoices/:id
	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.invoicesService.findOne(id);
	}

	// PATCH /sales/invoices/:id/approve
	@Patch(':id/approve')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	approve(@Param('id') id: string) {
		return this.invoicesService.approve(id);
	}

	// PATCH /sales/invoices/:id/paid
	@Patch(':id/paid')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	markAsPaid(@Param('id') id: string) {
		return this.invoicesService.markAsPaid(id);
	}

	// PATCH /sales/invoices/:id/void
	@Patch(':id/void')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	void(@Param('id') id: string, @Body('reason') reason: string) {
		return this.invoicesService.void(id, reason);
	}
}
