import { Test, TestingModule } from '@nestjs/testing';
import { PayrollController } from './payroll.controller';
import { PayrollService } from '../services/payroll.service';

const mockPayrollService = () => ({
  generate: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findOne: jest.fn(),
  getEmployeePayslip: jest.fn(),
  approve: jest.fn(),
  markAsPaid: jest.fn(),
});

describe('PayrollController', () => {
  let controller: PayrollController;
  let service: ReturnType<typeof mockPayrollService>;

  beforeEach(async () => {
    service = mockPayrollService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: service }],
    }).compile();

    controller = module.get<PayrollController>(PayrollController);
  });

  it('generate should delegate to payrollService.generate', async () => {
    const dto = { month: 1, year: 2025 } as any;
    service.generate.mockResolvedValue({ id: 'payroll-1' });

    const result = await controller.generate(dto);

    expect(service.generate).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'payroll-1' });
  });

  it('findAll should delegate to payrollService.findAll', async () => {
    service.findAll.mockResolvedValue([{ id: 'payroll-1' }]);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'payroll-1' }]);
  });

  it('getSummary should delegate to payrollService.getSummary with the parsed year', async () => {
    service.getSummary.mockResolvedValue({ year: 2025 });

    const result = await controller.getSummary('2025');

    expect(service.getSummary).toHaveBeenCalledWith(2025);
    expect(result).toEqual({ year: 2025 });
  });

  it('getSummary should default to the current year when no year is given', async () => {
    service.getSummary.mockResolvedValue({});

    await controller.getSummary(undefined as any);

    expect(service.getSummary).toHaveBeenCalledWith(new Date().getFullYear());
  });

  it('findOne should delegate to payrollService.findOne with id', async () => {
    service.findOne.mockResolvedValue({ id: 'payroll-1' });

    const result = await controller.findOne('payroll-1');

    expect(service.findOne).toHaveBeenCalledWith('payroll-1');
    expect(result).toEqual({ id: 'payroll-1' });
  });

  it('getPayslip should delegate to payrollService.getEmployeePayslip with id and employeeId', async () => {
    service.getEmployeePayslip.mockResolvedValue({ netSalary: 18170 });

    const result = await controller.getPayslip('payroll-1', 'emp-1');

    expect(service.getEmployeePayslip).toHaveBeenCalledWith(
      'payroll-1',
      'emp-1',
    );
    expect(result).toEqual({ netSalary: 18170 });
  });

  it('approve should delegate to payrollService.approve with id', async () => {
    service.approve.mockResolvedValue({ id: 'payroll-1', status: 'APPROVED' });

    const result = await controller.approve('payroll-1');

    expect(service.approve).toHaveBeenCalledWith('payroll-1');
    expect(result).toEqual({ id: 'payroll-1', status: 'APPROVED' });
  });

  it('markAsPaid should delegate to payrollService.markAsPaid with id', async () => {
    service.markAsPaid.mockResolvedValue({ id: 'payroll-1', status: 'PAID' });

    const result = await controller.markAsPaid('payroll-1');

    expect(service.markAsPaid).toHaveBeenCalledWith('payroll-1');
    expect(result).toEqual({ id: 'payroll-1', status: 'PAID' });
  });
});
