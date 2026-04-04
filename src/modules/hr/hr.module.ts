import { Module } from '@nestjs/common';
import { EmployeesController } from './controllers/employees.controller';
import { PayrollController } from './controllers/payroll.controller';
import { LeaveController } from './controllers/leave.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { RecruitmentController } from './controllers/recruitment.controller';
import { AppraisalsController } from './controllers/appraisals.controller';
import {
  AllowancesLoansController,
  HrAllowancesLoansGlobalController,
} from './controllers/allowances-loans.controller';
import { EmployeesService } from './services/employees.service';
import { PayrollService } from './services/payroll.service';
import { LeaveService } from './services/leave.service';
import { AttendanceService } from './services/attendance.service';
import { RecruitmentService } from './services/recruitment.service';
import { AppraisalsService } from './services/appraisals.service';
import { AllowancesLoansService } from './services/allowances-loans.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [
    EmployeesController,
    PayrollController,
    LeaveController,
    AttendanceController,
    RecruitmentController,
    AppraisalsController,
    AllowancesLoansController,
    HrAllowancesLoansGlobalController,
  ],
  providers: [
    EmployeesService,
    PayrollService,
    LeaveService,
    AttendanceService,
    RecruitmentService,
    AppraisalsService,
    AllowancesLoansService,
  ],
  exports: [EmployeesService],
})
export class HrModule {}
