import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from '../services/expenses.service';
import { CreateExpenseDto, ApproveExpenseDto, PayExpenseDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounting/expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @ApiOperation({ summary: 'Record a new expense (draft, not yet posted)' })
  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @ApiOperation({
    summary: 'List expenses, optionally filtered by status, with pagination',
  })
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.expensesService.findAll(+page || 1, +limit || 20, status);
  }

  @ApiOperation({ summary: 'Get a single expense by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @ApiOperation({
    summary:
      'Approve an expense — posts straight to PAID if already paid, otherwise to Accounts Payable',
  })
  @Post(':id/approve')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string, @Body() dto: ApproveExpenseDto) {
    return this.expensesService.approve(id, dto);
  }

  @ApiOperation({ summary: 'Pay an approved (payable) expense' })
  @Post(':id/pay')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  pay(@Param('id') id: string, @Body() dto: PayExpenseDto) {
    return this.expensesService.pay(id, dto);
  }

  @ApiOperation({ summary: 'Void an expense' })
  @Patch(':id/void')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(@Param('id') id: string) {
    return this.expensesService.void(id);
  }
}
