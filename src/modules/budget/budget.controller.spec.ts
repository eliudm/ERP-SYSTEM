import { Test, TestingModule } from '@nestjs/testing';
import { BudgetStatus } from '@prisma/client';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

const mockBudgetService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  setStatus: jest.fn(),
  addLines: jest.fn(),
  deleteLine: jest.fn(),
  getBudgetVsActual: jest.fn(),
});

describe('BudgetController', () => {
  let controller: BudgetController;
  let service: ReturnType<typeof mockBudgetService>;

  beforeEach(async () => {
    service = mockBudgetService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [{ provide: BudgetService, useValue: service }],
    }).compile();

    controller = module.get<BudgetController>(BudgetController);
  });

  describe('create', () => {
    it('should call budgetService.create with dto and the requesting user id', async () => {
      const dto = { name: 'Ops', fiscalYear: 2025 };
      const expected = { id: 'budget-1', ...dto };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any, {
        user: { id: 'user-1' },
      } as any);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should parse fiscalYear and pass status through', async () => {
      const expected = [{ id: 'budget-1' }];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('2025', BudgetStatus.ACTIVE);

      expect(service.findAll).toHaveBeenCalledWith(2025, BudgetStatus.ACTIVE);
      expect(result).toEqual(expected);
    });

    it('should pass undefined fiscalYear when not provided', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll(undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('findOne', () => {
    it('should call budgetService.findOne with the id', async () => {
      const expected = { id: 'budget-1' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('budget-1');

      expect(service.findOne).toHaveBeenCalledWith('budget-1');
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should call budgetService.update with id and dto', async () => {
      const dto = { name: 'Renamed' };
      const expected = { id: 'budget-1', ...dto };
      service.update.mockResolvedValue(expected);

      const result = await controller.update('budget-1', dto as any);

      expect(service.update).toHaveBeenCalledWith('budget-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('setStatus', () => {
    it('should call budgetService.setStatus with id and dto', async () => {
      const dto = { status: BudgetStatus.ACTIVE };
      const expected = { id: 'budget-1', status: BudgetStatus.ACTIVE };
      service.setStatus.mockResolvedValue(expected);

      const result = await controller.setStatus('budget-1', dto);

      expect(service.setStatus).toHaveBeenCalledWith('budget-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('addLines', () => {
    it('should call budgetService.addLines with id and lines', async () => {
      const lines = [{ accountId: 'acc-1', month: 1, amount: 100 }];
      const expected = { upserted: 1 };
      service.addLines.mockResolvedValue(expected);

      const result = await controller.addLines('budget-1', lines as any);

      expect(service.addLines).toHaveBeenCalledWith('budget-1', lines);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteLine', () => {
    it('should call budgetService.deleteLine with budgetId and lineId', async () => {
      const expected = { deleted: true };
      service.deleteLine.mockResolvedValue(expected);

      const result = await controller.deleteLine('budget-1', 'line-1');

      expect(service.deleteLine).toHaveBeenCalledWith('budget-1', 'line-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getBudgetVsActual', () => {
    it('should call budgetService.getBudgetVsActual with the id', async () => {
      const expected = { summary: {} };
      service.getBudgetVsActual.mockResolvedValue(expected);

      const result = await controller.getBudgetVsActual('budget-1');

      expect(service.getBudgetVsActual).toHaveBeenCalledWith('budget-1');
      expect(result).toEqual(expected);
    });
  });
});
