import {
	Controller, Get, Post, Body,
	Param, Patch, UseGuards, Query,
} from '@nestjs/common';
import { AccountsService } from '../services/accounts.service';
import { CreateAccountDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('accounting/accounts')
export class AccountsController {
	constructor(private accountsService: AccountsService) {}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	create(@Body() dto: CreateAccountDto) {
		return this.accountsService.create(dto);
	}

	@Post('seed')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN)
	seed() {
		return this.accountsService.seedChartOfAccounts();
	}

	@Get()
	findAll() {
		return this.accountsService.findAll();
	}

	@Get('by-type/:type')
	findByType(@Param('type') type: string) {
		return this.accountsService.findByType(type);
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.accountsService.findOne(id);
	}

	@Get(':id/balance')
	getBalance(@Param('id') id: string) {
		return this.accountsService.getBalance(id);
	}

	@Patch(':id/deactivate')
	@UseGuards(RolesGuard)
	@Roles(Role.ADMIN, Role.ACCOUNTANT)
	deactivate(@Param('id') id: string) {
		return this.accountsService.deactivate(id);
	}
}
