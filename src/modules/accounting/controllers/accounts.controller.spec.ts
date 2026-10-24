import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../services/accounts.service';

const mockAccountsService = () => ({
  create: jest.fn(),
  seedChartOfAccounts: jest.fn(),
  findAll: jest.fn(),
  findByType: jest.fn(),
  findOne: jest.fn(),
  getBalance: jest.fn(),
  deactivate: jest.fn(),
});

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: ReturnType<typeof mockAccountsService>;

  beforeEach(async () => {
    service = mockAccountsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: service }],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  describe('create', () => {
    it('should delegate to accountsService.create', async () => {
      const dto = { code: '1000', name: 'Cash', type: 'ASSET' as any };
      service.create.mockResolvedValue({ id: 'acc-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'acc-1', ...dto });
    });
  });

  describe('seed', () => {
    it('should delegate to accountsService.seedChartOfAccounts', async () => {
      service.seedChartOfAccounts.mockResolvedValue({ message: 'Seeded 19 accounts successfully', accounts: [] });

      const result = await controller.seed();

      expect(service.seedChartOfAccounts).toHaveBeenCalledWith();
      expect(result).toEqual({ message: 'Seeded 19 accounts successfully', accounts: [] });
    });
  });

  describe('findAll', () => {
    it('should delegate to accountsService.findAll', async () => {
      service.findAll.mockResolvedValue([{ id: '1' }]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('findByType', () => {
    it('should delegate to accountsService.findByType with the type param', async () => {
      service.findByType.mockResolvedValue([{ id: '1', type: 'ASSET' }]);

      const result = await controller.findByType('ASSET');

      expect(service.findByType).toHaveBeenCalledWith('ASSET');
      expect(result).toEqual([{ id: '1', type: 'ASSET' }]);
    });
  });

  describe('findOne', () => {
    it('should delegate to accountsService.findOne with the id param', async () => {
      service.findOne.mockResolvedValue({ id: 'acc-1' });

      const result = await controller.findOne('acc-1');

      expect(service.findOne).toHaveBeenCalledWith('acc-1');
      expect(result).toEqual({ id: 'acc-1' });
    });
  });

  describe('getBalance', () => {
    it('should delegate to accountsService.getBalance with the id param', async () => {
      service.getBalance.mockResolvedValue({ balance: 100 });

      const result = await controller.getBalance('acc-1');

      expect(service.getBalance).toHaveBeenCalledWith('acc-1');
      expect(result).toEqual({ balance: 100 });
    });
  });

  describe('deactivate', () => {
    it('should delegate to accountsService.deactivate with the id param', async () => {
      service.deactivate.mockResolvedValue({ id: 'acc-1', isActive: false });

      const result = await controller.deactivate('acc-1');

      expect(service.deactivate).toHaveBeenCalledWith('acc-1');
      expect(result).toEqual({ id: 'acc-1', isActive: false });
    });
  });
});
