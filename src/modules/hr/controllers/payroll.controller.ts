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
import { PayrollService } from '../services/payroll.service';
import { CreatePayrollDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @Post('generate')
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  generate(@Body() dto: CreatePayrollDto) {
    return this.payrollService.generate(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findAll() {
    return this.payrollService.findAll();
  }

  @Get('summary')
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  getSummary(@Query('year') year: string) {
    return this.payrollService.getSummary(+year || new Date().getFullYear());
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Get(':id/payslip/:employeeId')
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getPayslip(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.payrollService.getEmployeePayslip(id, employeeId);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.payrollService.approve(id);
  }

  @Patch(':id/paid')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
