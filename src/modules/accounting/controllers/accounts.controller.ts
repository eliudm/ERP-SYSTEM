import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { CreateAccountDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @ApiOperation({ summary: 'Create a new chart-of-accounts entry' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @ApiOperation({ summary: 'Seed the default chart of accounts' })
  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  seed() {
    return this.accountsService.seedChartOfAccounts();
  }

  @ApiOperation({ summary: 'List all chart-of-accounts entries' })
  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @ApiOperation({ summary: 'List accounts filtered by account type' })
  @Get('by-type/:type')
  findByType(@Param('type') type: string) {
    return this.accountsService.findByType(type);
  }

  @ApiOperation({ summary: 'Get a single account by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @ApiOperation({ summary: 'Get the current balance of an account' })
  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.accountsService.getBalance(id);
  }

  @ApiOperation({ summary: 'Deactivate an account' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deactivate(@Param('id') id: string) {
    return this.accountsService.deactivate(id);
  }
}
