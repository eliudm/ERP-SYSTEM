import { Test, TestingModule } from '@nestjs/testing';
import { LeaveController } from './leave.controller';
import { LeaveService } from '../services/leave.service';

const mockLeaveService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  getLeaveBalance: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
});

describe('LeaveController', () => {
  let controller: LeaveController;
  let service: ReturnType<typeof mockLeaveService>;

  beforeEach(async () => {
    service = mockLeaveService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveController],
      providers: [{ provide: LeaveService, useValue: service }],
    }).compile();

    controller = module.get<LeaveController>(LeaveController);
  });

  it('create should delegate to leaveService.create', async () => {
    const dto = { employeeId: 'emp-1' } as any;
    service.create.mockResolvedValue({ id: 'leave-1' });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'leave-1' });
  });

  it('findAll should delegate to leaveService.findAll with status and employeeId', async () => {
    service.findAll.mockResolvedValue([{ id: 'leave-1' }]);

    const result = await controller.findAll('PENDING', 'emp-1');

    expect(service.findAll).toHaveBeenCalledWith('PENDING', 'emp-1');
    expect(result).toEqual([{ id: 'leave-1' }]);
  });

  it('getBalance should delegate to leaveService.getLeaveBalance with employeeId', async () => {
    service.getLeaveBalance.mockResolvedValue({ year: 2024, balance: [] });

    const result = await controller.getBalance('emp-1');

    expect(service.getLeaveBalance).toHaveBeenCalledWith('emp-1');
    expect(result).toEqual({ year: 2024, balance: [] });
  });

  it('approve should delegate to leaveService.approve with id and approverId', async () => {
    service.approve.mockResolvedValue({ id: 'leave-1', status: 'APPROVED' });

    const result = await controller.approve('leave-1', 'approver-1');

    expect(service.approve).toHaveBeenCalledWith('leave-1', 'approver-1');
    expect(result).toEqual({ id: 'leave-1', status: 'APPROVED' });
  });

  it('reject should delegate to leaveService.reject with id', async () => {
    service.reject.mockResolvedValue({ id: 'leave-1', status: 'REJECTED' });

    const result = await controller.reject('leave-1');

    expect(service.reject).toHaveBeenCalledWith('leave-1');
    expect(result).toEqual({ id: 'leave-1', status: 'REJECTED' });
  });
});
