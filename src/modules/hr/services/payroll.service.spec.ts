import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { WorkflowService } from '../../workflow/workflow.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApprovalEntityType, PayrollStatus } from '@prisma/client';

const mockPrisma = () => ({
  payroll: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
  },
  allowance: {
    findMany: jest.fn(),
  },
  loanDeduction: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
  },
  payrollLine: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockPostingEngine = () => ({
  postTransaction: jest.fn(),
});

const mockWorkflowService = () => ({
  assertApprovalIfExists: jest.fn(),
  consumeApprovedRequest: jest.fn(),
});

describe('PayrollService', () => {
  let service: PayrollService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: ReturnType<typeof mockPostingEngine>;
  let workflowService: ReturnType<typeof mockWorkflowService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = mockPostingEngine();
    workflowService = mockWorkflowService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: WorkflowService, useValue: workflowService },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  describe('calculatePayslip', () => {
    it('should compute zero PAYE for low income inside the tax-free relief band', () => {
      const result = service.calculatePayslip(20000);

      expect(result.deductions.paye).toBe(0);
      expect(result.deductions.nhif).toBe(750);
      expect(result.deductions.nssf).toBe(1080);
      expect(result.netSalary).toBe(18170);
    });

    it('should compute PAYE at the 25% band after relief', () => {
      const result = service.calculatePayslip(28000);

      expect(result.deductions.paye).toBe(1000);
      expect(result.deductions.nhif).toBe(850);
      expect(result.deductions.nssf).toBe(1080);
      expect(result.netSalary).toBe(25070);
    });

    it('should compute PAYE at the 30% band after relief', () => {
      const result = service.calculatePayslip(50000);

      expect(result.deductions.paye).toBe(7383.35);
      expect(result.deductions.nhif).toBe(1200);
      expect(result.deductions.nssf).toBe(1080);
      expect(result.netSalary).toBe(40336.65);
    });
  });

  describe('generate', () => {
    const dto = { month: 1, year: 2025 };

    it('should throw ConflictException if payroll already exists for the period', async () => {
      prisma.payroll.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.generate(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if there are no active employees', async () => {
      prisma.payroll.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([]);

      await expect(service.generate(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should build payroll lines with calculated deductions and totals', async () => {
      prisma.payroll.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', salary: 20000 },
      ]);
      prisma.allowance.findMany.mockResolvedValue([]);
      prisma.loanDeduction.findMany.mockResolvedValue([]);
      const expectedPayroll = { id: 'payroll-1' };
      prisma.$transaction.mockResolvedValue([expectedPayroll]);

      const result = await service.generate(dto as any);

      expect(prisma.payroll.create).toHaveBeenCalledWith({
        data: {
          month: 1,
          year: 2025,
          status: PayrollStatus.DRAFT,
          totalGross: 20000,
          totalPaye: 0,
          totalNhif: 750,
          totalNssf: 1080,
          totalNet: 18170,
          lines: {
            create: [
              expect.objectContaining({
                employeeId: 'emp-1',
                grossSalary: 20000,
                payeAmount: 0,
                nhifAmount: 750,
                nssfAmount: 1080,
                netSalary: 18170,
                totalAllowances: 0,
                totalLoanDeductions: 0,
              }),
            ],
          },
        },
        include: { lines: { include: { employee: true } } },
      });
      expect(result).toEqual(expectedPayroll);
    });

    it('should add active allowances to gross pay and deduct active loan installments from net pay', async () => {
      prisma.payroll.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', salary: 20000 },
      ]);
      prisma.allowance.findMany.mockResolvedValue([
        { employeeId: 'emp-1', type: 'TRANSPORT', amount: 5000 },
      ]);
      prisma.loanDeduction.findMany.mockResolvedValue([
        {
          id: 'loan-1',
          employeeId: 'emp-1',
          monthlyDeduction: 1000,
          balance: 3000,
        },
      ]);
      prisma.$transaction.mockResolvedValue([{ id: 'payroll-1' }]);

      await service.generate(dto as any);

      // gross = 20000 + 5000 = 25000 -> payslip deductions differ from the no-allowance case
      const payslip = service.calculatePayslip(25000);
      const expectedNet = payslip.netSalary - 1000;

      expect(prisma.payroll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: {
              create: [
                expect.objectContaining({
                  employeeId: 'emp-1',
                  grossSalary: 25000,
                  totalAllowances: 5000,
                  totalLoanDeductions: 1000,
                  netSalary: expectedNet,
                }),
              ],
            },
          }),
        }),
      );
      expect(prisma.loanDeduction.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: { balance: 2000, isActive: true },
      });
    });
  });

  describe('approve', () => {
    const existingPayroll = {
      id: 'payroll-1',
      month: 1,
      year: 2025,
      status: PayrollStatus.DRAFT,
      totalGross: 20000,
      totalPaye: 0,
      totalNhif: 750,
      totalNssf: 1080,
      totalNet: 18170,
    };

    it('should post the payroll journal entry and mark it APPROVED', async () => {
      workflowService.assertApprovalIfExists.mockResolvedValue(undefined);
      prisma.payroll.findUnique.mockResolvedValue(existingPayroll);
      prisma.account.findFirst.mockResolvedValue({ id: 'acct-1' });
      postingEngine.postTransaction.mockResolvedValue({});
      const updated = { ...existingPayroll, status: PayrollStatus.APPROVED };
      prisma.payroll.update.mockResolvedValue(updated);
      workflowService.consumeApprovedRequest.mockResolvedValue(undefined);

      const result = await service.approve('payroll-1');

      expect(workflowService.assertApprovalIfExists).toHaveBeenCalledWith(
        ApprovalEntityType.PAYROLL,
        'payroll-1',
      );
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'PAYROLL',
          sourceId: 'payroll-1',
          lines: [
            expect.objectContaining({ debit: 20000, credit: 0 }),
            expect.objectContaining({ debit: 0, credit: 0 }),
            expect.objectContaining({ debit: 0, credit: 750 }),
            expect.objectContaining({ debit: 0, credit: 1080 }),
            expect.objectContaining({ debit: 0, credit: 18170 }),
          ],
        }),
      );
      expect(prisma.payroll.update).toHaveBeenCalledWith({
        where: { id: 'payroll-1' },
        data: { status: PayrollStatus.APPROVED },
        include: { lines: { include: { employee: true } } },
      });
      expect(workflowService.consumeApprovedRequest).toHaveBeenCalledWith(
        ApprovalEntityType.PAYROLL,
        'payroll-1',
      );
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if payroll does not exist', async () => {
      workflowService.assertApprovalIfExists.mockResolvedValue(undefined);
      prisma.payroll.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payroll is not DRAFT', async () => {
      workflowService.assertApprovalIfExists.mockResolvedValue(undefined);
      prisma.payroll.findUnique.mockResolvedValue({
        ...existingPayroll,
        status: PayrollStatus.APPROVED,
      });

      await expect(service.approve('payroll-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if required accounts are missing', async () => {
      workflowService.assertApprovalIfExists.mockResolvedValue(undefined);
      prisma.payroll.findUnique.mockResolvedValue(existingPayroll);
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.approve('payroll-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
    });
  });

  describe('markAsPaid', () => {
    const approvedPayroll = {
      id: 'payroll-1',
      month: 1,
      year: 2025,
      status: PayrollStatus.APPROVED,
      totalNet: 18170,
    };

    it('should post the payment journal entry and mark payroll PAID', async () => {
      prisma.payroll.findUnique.mockResolvedValue(approvedPayroll);
      prisma.account.findFirst.mockResolvedValue({ id: 'acct-1' });
      postingEngine.postTransaction.mockResolvedValue({});
      const paid = { ...approvedPayroll, status: PayrollStatus.PAID };
      prisma.payroll.update.mockResolvedValue(paid);

      const result = await service.markAsPaid('payroll-1');

      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'PAYROLL_PAYMENT',
          sourceId: 'payroll-1',
          lines: [
            expect.objectContaining({ debit: 18170, credit: 0 }),
            expect.objectContaining({ debit: 0, credit: 18170 }),
          ],
        }),
      );
      expect(prisma.payroll.update).toHaveBeenCalledWith({
        where: { id: 'payroll-1' },
        data: { status: PayrollStatus.PAID },
      });
      expect(result).toEqual(paid);
    });

    it('should throw NotFoundException if payroll does not exist', async () => {
      prisma.payroll.findUnique.mockResolvedValue(null);

      await expect(service.markAsPaid('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payroll is not APPROVED', async () => {
      prisma.payroll.findUnique.mockResolvedValue({
        ...approvedPayroll,
        status: PayrollStatus.DRAFT,
      });

      await expect(service.markAsPaid('payroll-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if required accounts are missing', async () => {
      prisma.payroll.findUnique.mockResolvedValue(approvedPayroll);
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.markAsPaid('payroll-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return payrolls ordered by year and month descending with line counts', async () => {
      prisma.payroll.findMany.mockResolvedValue([{ id: 'payroll-1' }]);

      const result = await service.findAll();

      expect(prisma.payroll.findMany).toHaveBeenCalledWith({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { _count: { select: { lines: true } } },
      });
      expect(result).toEqual([{ id: 'payroll-1' }]);
    });
  });

  describe('findOne', () => {
    it('should return a payroll with its lines', async () => {
      const payroll = { id: 'payroll-1', lines: [] };
      prisma.payroll.findUnique.mockResolvedValue(payroll);

      const result = await service.findOne('payroll-1');

      expect(result).toEqual(payroll);
    });

    it('should throw NotFoundException if payroll does not exist', async () => {
      prisma.payroll.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEmployeePayslip', () => {
    it('should return a formatted payslip for the employee', async () => {
      prisma.payrollLine.findFirst.mockResolvedValue({
        employee: { id: 'emp-1' },
        payroll: { month: 1, year: 2025 },
        grossSalary: 20000,
        payeAmount: 0,
        nhifAmount: 750,
        nssfAmount: 1080,
        netSalary: 18170,
      });

      const result = await service.getEmployeePayslip(
        'payroll-1',
        'emp-1',
      );

      expect(result).toEqual({
        employee: { id: 'emp-1' },
        period: { month: 1, year: 2025 },
        earnings: { basicSalary: 20000, grossSalary: 20000 },
        deductions: { paye: 0, nhif: 750, nssf: 1080, total: 1830 },
        netSalary: 18170,
      });
    });

    it('should throw NotFoundException if payslip does not exist', async () => {
      prisma.payrollLine.findFirst.mockResolvedValue(null);

      await expect(
        service.getEmployeePayslip('payroll-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('should aggregate annual totals from monthly payrolls', async () => {
      prisma.payroll.findMany.mockResolvedValue([
        { month: 1, totalGross: 20000, totalPaye: 0, totalNet: 18170 },
        { month: 2, totalGross: 28000, totalPaye: 1000, totalNet: 25070 },
      ]);

      const result = await service.getSummary(2025);

      expect(prisma.payroll.findMany).toHaveBeenCalledWith({
        where: { year: 2025 },
        orderBy: { month: 'asc' },
      });
      expect(result.annualTotals).toEqual({
        grossSalaries: 48000,
        totalPaye: 1000,
        netSalaries: 43240,
      });
    });
  });
});
