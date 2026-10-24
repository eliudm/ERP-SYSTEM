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
import { PayrollService } from '../services/payroll.service';
import { CreatePayrollDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @ApiOperation({ summary: 'Generate a new payroll run' })
  @Post('generate')
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  generate(@Body() dto: CreatePayrollDto) {
    return this.payrollService.generate(dto);
  }

  @ApiOperation({ summary: 'List all payroll runs' })
  @Get()
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findAll() {
    return this.payrollService.findAll();
  }

  @ApiOperation({ summary: 'Get payroll summary totals for a given year' })
  @Get('summary')
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  getSummary(@Query('year') year: string) {
    return this.payrollService.getSummary(+year || new Date().getFullYear());
  }

  @ApiOperation({ summary: 'Get a single payroll run by id' })
  @Get(':id')
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @ApiOperation({ summary: 'Get an employee payslip for a given payroll run' })
  @Get(':id/payslip/:employeeId')
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getPayslip(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.payrollService.getEmployeePayslip(id, employeeId);
  }

  @ApiOperation({ summary: 'Approve a payroll run' })
  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.payrollService.approve(id);
  }

  @ApiOperation({ summary: 'Mark a payroll run as paid' })
  @Patch(':id/paid')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
