import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from '../services/journal-entries.service';

const mockJournalService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  void: jest.fn(),
  getTrialBalance: jest.fn(),
  getProfitAndLoss: jest.fn(),
  createPeriod: jest.fn(),
  getPeriods: jest.fn(),
  lockPeriod: jest.fn(),
});

describe('JournalEntriesController', () => {
  let controller: JournalEntriesController;
  let service: ReturnType<typeof mockJournalService>;

  beforeEach(async () => {
    service = mockJournalService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JournalEntriesController],
      providers: [{ provide: JournalEntriesService, useValue: service }],
    }).compile();

    controller = module.get<JournalEntriesController>(JournalEntriesController);
  });

  describe('create', () => {
    it('should delegate to journalService.create with dto and req.user.id', async () => {
      const dto = { reference: 'JE-1' } as any;
      service.create.mockResolvedValue({ id: 'je-1' });

      const result = await controller.create(dto, { user: { id: 'user-1' } });

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual({ id: 'je-1' });
    });

    it('should pass undefined userId when req.user is missing', async () => {
      const dto = { reference: 'JE-1' } as any;
      service.create.mockResolvedValue({ id: 'je-1' });

      await controller.create(dto, {});

      expect(service.create).toHaveBeenCalledWith(dto, undefined);
    });
  });

  describe('findAll', () => {
    it('should parse page and limit query params', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll('2', '5');

      expect(service.findAll).toHaveBeenCalledWith(2, 5);
    });

    it('should default page and limit when params are missing', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(undefined as any, undefined as any);

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('findOne', () => {
    it('should delegate to journalService.findOne with the id param', async () => {
      service.findOne.mockResolvedValue({ id: 'je-1' });

      const result = await controller.findOne('je-1');

      expect(service.findOne).toHaveBeenCalledWith('je-1');
      expect(result).toEqual({ id: 'je-1' });
    });
  });

  describe('void', () => {
    it('should delegate to journalService.void with id, reason, and req.user.id', async () => {
      service.void.mockResolvedValue({ id: 'reversal-1' });

      const result = await controller.void('je-1', 'mistake', { user: { id: 'user-1' } });

      expect(service.void).toHaveBeenCalledWith('je-1', 'mistake', 'user-1');
      expect(result).toEqual({ id: 'reversal-1' });
    });
  });

  describe('getTrialBalance', () => {
    it('should delegate to journalService.getTrialBalance', async () => {
      service.getTrialBalance.mockResolvedValue({ accounts: [], totals: {} });

      const result = await controller.getTrialBalance();

      expect(service.getTrialBalance).toHaveBeenCalledWith();
      expect(result).toEqual({ accounts: [], totals: {} });
    });
  });

  describe('getProfitAndLoss', () => {
    it('should delegate to journalService.getProfitAndLoss with the date params', async () => {
      service.getProfitAndLoss.mockResolvedValue({ profitBeforeTax: 100 });

      const result = await controller.getProfitAndLoss('2024-01-01', '2024-01-31');

      expect(service.getProfitAndLoss).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      expect(result).toEqual({ profitBeforeTax: 100 });
    });
  });

  describe('createPeriod', () => {
    it('should delegate to journalService.createPeriod with dto', async () => {
      const dto = { name: 'Jan', startDate: '2024-01-01', endDate: '2024-01-31' };
      service.createPeriod.mockResolvedValue({ id: 'p1', ...dto });

      const result = await controller.createPeriod(dto);

      expect(service.createPeriod).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'p1', ...dto });
    });
  });

  describe('getPeriods', () => {
    it('should delegate to journalService.getPeriods', async () => {
      service.getPeriods.mockResolvedValue([{ id: 'p1' }]);

      const result = await controller.getPeriods();

      expect(service.getPeriods).toHaveBeenCalledWith();
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  describe('lockPeriod', () => {
    it('should delegate to journalService.lockPeriod with the id param', async () => {
      service.lockPeriod.mockResolvedValue({ id: 'p1', isLocked: true });

      const result = await controller.lockPeriod('p1');

      expect(service.lockPeriod).toHaveBeenCalledWith('p1');
      expect(result).toEqual({ id: 'p1', isLocked: true });
    });
  });
});
