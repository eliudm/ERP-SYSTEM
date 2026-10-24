import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AllowancesLoansService } from '../services/allowances-loans.service';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/employees')
export class AllowancesLoansController {
  constructor(
    private readonly allowancesLoansService: AllowancesLoansService,
  ) {}

  // ─── Allowances ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new allowance for an employee' })
  @Post(':id/allowances')
  createAllowance(
    @Param('id') id: string,
    @Body()
    body: {
      type: string;
      amount: number;
      notes?: string;
      isRecurring?: boolean;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.allowancesLoansService.createAllowance({
      ...body,
      employeeId: id,
    });
  }

  @ApiOperation({ summary: 'List allowances for an employee' })
  @Get(':id/allowances')
  findAllowances(@Param('id') id: string) {
    return this.allowancesLoansService.findAllowances(id);
  }

  @ApiOperation({ summary: 'Update an existing allowance' })
  @Patch(':id/allowances/:allowanceId')
  updateAllowance(
    @Param('allowanceId') allowanceId: string,
    @Body()
    body: Partial<{
      amount: number;
      notes: string;
      isRecurring: boolean;
      endDate: string;
      isActive: boolean;
    }>,
  ) {
    return this.allowancesLoansService.updateAllowance(allowanceId, body);
  }

  @ApiOperation({ summary: 'Deactivate an employee allowance' })
  @Post(':id/allowances/:allowanceId/deactivate')
  deactivateAllowance(@Param('allowanceId') allowanceId: string) {
    return this.allowancesLoansService.deactivateAllowance(allowanceId);
  }

  // ─── Loans ──────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new loan for an employee' })
  @Post(':id/loans')
  createLoan(
    @Param('id') id: string,
    @Body()
    body: {
      totalAmount: number;
      monthlyDeduction: number;
      description?: string;
      startDate?: string;
    },
  ) {
    return this.allowancesLoansService.createLoan({ ...body, employeeId: id });
  }

  @ApiOperation({ summary: 'List loans for an employee' })
  @Get(':id/loans')
  findLoans(@Param('id') id: string) {
    return this.allowancesLoansService.findLoans(id);
  }

  @ApiOperation({ summary: 'Get a summary of an employee loan' })
  @Get(':id/loans/summary')
  getLoanSummary(@Param('id') id: string) {
    return this.allowancesLoansService.getLoanSummary(id);
  }

  @ApiOperation({ summary: 'Record an installment payment towards a loan' })
  @Post(':id/loans/:loanId/pay-installment')
  recordInstallmentPayment(
    @Param('loanId') loanId: string,
    @Body() body: { amount?: number },
  ) {
    return this.allowancesLoansService.recordInstallmentPayment(
      loanId,
      body.amount,
    );
  }
}

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrAllowancesLoansGlobalController {
  constructor(
    private readonly allowancesLoansService: AllowancesLoansService,
  ) {}

  // ─── Global Allowances ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all allowances, optionally filtered by employee' })
  @Get('allowances')
  getAllAllowances(@Query('employeeId') employeeId?: string) {
    return this.allowancesLoansService.findAllAllowances(employeeId);
  }

  @ApiOperation({ summary: 'Create a new allowance' })
  @Post('allowances')
  createAllowance(
    @Body()
    body: {
      employeeId: string;
      type: string;
      amount: number;
      notes?: string;
      isRecurring?: boolean;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.allowancesLoansService.createAllowance(body);
  }

  @ApiOperation({ summary: 'Deactivate an allowance by id' })
  @Delete('allowances/:id')
  deactivateAllowance(@Param('id') id: string) {
    return this.allowancesLoansService.deactivateAllowance(id);
  }

  // ─── Global Loans ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all loans, optionally filtered by employee' })
  @Get('loans')
  getAllLoans(@Query('employeeId') employeeId?: string) {
    return this.allowancesLoansService.findAllLoans(employeeId);
  }

  @ApiOperation({ summary: 'Create a new loan' })
  @Post('loans')
  createLoan(
    @Body()
    body: {
      employeeId: string;
      totalAmount: number;
      monthlyDeduction: number;
      description?: string;
      startDate?: string;
    },
  ) {
    return this.allowancesLoansService.createLoan(body);
  }
}
