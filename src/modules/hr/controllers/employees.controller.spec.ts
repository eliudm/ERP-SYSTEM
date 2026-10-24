import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from '../services/employees.service';

const mockEmployeesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  getHeadcount: jest.fn(),
  getDepartments: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  terminate: jest.fn(),
});

describe('EmployeesController', () => {
  let controller: EmployeesController;
  let service: ReturnType<typeof mockEmployeesService>;

  beforeEach(async () => {
    service = mockEmployeesService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: service }],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  it('create should delegate to employeesService.create', async () => {
    const dto = { firstName: 'Jane' } as any;
    service.create.mockResolvedValue({ id: 'emp-1' });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'emp-1' });
  });

  it('findAll should delegate to employeesService.findAll with search and department', async () => {
    service.findAll.mockResolvedValue([{ id: 'emp-1' }]);

    const result = await controller.findAll('jane', 'Finance');

    expect(service.findAll).toHaveBeenCalledWith('jane', 'Finance');
    expect(result).toEqual([{ id: 'emp-1' }]);
  });

  it('getHeadcount should delegate to employeesService.getHeadcount', async () => {
    service.getHeadcount.mockResolvedValue({ total: 5 });

    const result = await controller.getHeadcount();

    expect(service.getHeadcount).toHaveBeenCalled();
    expect(result).toEqual({ total: 5 });
  });

  it('getDepartments should delegate to employeesService.getDepartments', async () => {
    service.getDepartments.mockResolvedValue(['Finance']);

    const result = await controller.getDepartments();

    expect(service.getDepartments).toHaveBeenCalled();
    expect(result).toEqual(['Finance']);
  });

  it('findOne should delegate to employeesService.findOne with id', async () => {
    service.findOne.mockResolvedValue({ id: 'emp-1' });

    const result = await controller.findOne('emp-1');

    expect(service.findOne).toHaveBeenCalledWith('emp-1');
    expect(result).toEqual({ id: 'emp-1' });
  });

  it('update should delegate to employeesService.update with id and dto', async () => {
    const dto = { firstName: 'Janet' } as any;
    service.update.mockResolvedValue({ id: 'emp-1', ...dto });

    const result = await controller.update('emp-1', dto);

    expect(service.update).toHaveBeenCalledWith('emp-1', dto);
    expect(result).toEqual({ id: 'emp-1', ...dto });
  });

  it('terminate should delegate to employeesService.terminate with id', async () => {
    service.terminate.mockResolvedValue({ id: 'emp-1', status: 'TERMINATED' });

    const result = await controller.terminate('emp-1');

    expect(service.terminate).toHaveBeenCalledWith('emp-1');
    expect(result).toEqual({ id: 'emp-1', status: 'TERMINATED' });
  });
});
