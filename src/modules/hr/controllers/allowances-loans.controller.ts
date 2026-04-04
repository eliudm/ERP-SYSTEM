import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AllowancesLoansService } from '../services/allowances-loans.service';

@UseGuards(JwtAuthGuard)
@Controller('hr/employees')
export class AllowancesLoansController {
  constructor(
    private readonly allowancesLoansService: AllowancesLoansService,
  ) {}

  // ─── Allowances ─────────────────────────────────────────────────────────────

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

  @Get(':id/allowances')
  findAllowances(@Param('id') id: string) {
    return this.allowancesLoansService.findAllowances(id);
  }

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

  @Post(':id/allowances/:allowanceId/deactivate')
  deactivateAllowance(@Param('allowanceId') allowanceId: string) {
    return this.allowancesLoansService.deactivateAllowance(allowanceId);
  }

  // ─── Loans ──────────────────────────────────────────────────────────────────

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

  @Get(':id/loans')
  findLoans(@Param('id') id: string) {
    return this.allowancesLoansService.findLoans(id);
  }

  @Get(':id/loans/summary')
  getLoanSummary(@Param('id') id: string) {
    return this.allowancesLoansService.getLoanSummary(id);
  }

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
