import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from '../services/expenses.service';

const mockExpensesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  pay: jest.fn(),
  void: jest.fn(),
});

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: ReturnType<typeof mockExpensesService>;

  beforeEach(async () => {
    service = mockExpensesService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: service }],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
  });

  describe('create', () => {
    it('should call expensesService.create with the dto', async () => {
      const dto = { payee: 'Landlord Co', amount: 50000 } as any;
      service.create.mockResolvedValue({ id: 'exp-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'exp-1', ...dto });
    });
  });

  describe('findAll', () => {
    it('should parse page/limit and pass status through', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      const result = await controller.findAll('2', '10', 'APPROVED');

      expect(service.findAll).toHaveBeenCalledWith(2, 10, 'APPROVED');
      expect(result).toEqual({ data: [], meta: {} });
    });

    it('should default page to 1 and limit to 20', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(
        undefined as any,
        undefined as any,
        undefined as any,
      );

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('findOne', () => {
    it('should call expensesService.findOne with the id', async () => {
      service.findOne.mockResolvedValue({ id: 'exp-1' });

      const result = await controller.findOne('exp-1');

      expect(service.findOne).toHaveBeenCalledWith('exp-1');
      expect(result).toEqual({ id: 'exp-1' });
    });
  });

  describe('approve', () => {
    it('should call expensesService.approve with the id and dto', async () => {
      const dto = { alreadyPaid: true, cashAccountId: 'acc-cash' } as any;
      service.approve.mockResolvedValue({ id: 'exp-1', status: 'PAID' });

      const result = await controller.approve('exp-1', dto);

      expect(service.approve).toHaveBeenCalledWith('exp-1', dto);
      expect(result).toEqual({ id: 'exp-1', status: 'PAID' });
    });
  });

  describe('pay', () => {
    it('should call expensesService.pay with the id and dto', async () => {
      const dto = { cashAccountId: 'acc-cash' } as any;
      service.pay.mockResolvedValue({ id: 'exp-1', status: 'PAID' });

      const result = await controller.pay('exp-1', dto);

      expect(service.pay).toHaveBeenCalledWith('exp-1', dto);
      expect(result).toEqual({ id: 'exp-1', status: 'PAID' });
    });
  });

  describe('void', () => {
    it('should call expensesService.void with the id', async () => {
      service.void.mockResolvedValue({ id: 'exp-1', status: 'VOID' });

      const result = await controller.void('exp-1');

      expect(service.void).toHaveBeenCalledWith('exp-1');
      expect(result).toEqual({ id: 'exp-1', status: 'VOID' });
    });
  });
});
