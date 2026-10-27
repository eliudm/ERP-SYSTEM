import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

const mockBranchesService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  getReport: jest.fn(),
  getComparison: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
});

describe('BranchesController', () => {
  let controller: BranchesController;
  let service: ReturnType<typeof mockBranchesService>;

  beforeEach(async () => {
    service = mockBranchesService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [{ provide: BranchesService, useValue: service }],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
  });

  describe('findAll', () => {
    it('should call branchesService.findAll', async () => {
      const expected = [{ id: 'branch-1' }];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call branchesService.findOne with the id', async () => {
      const expected = { id: 'branch-1' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('branch-1');

      expect(service.findOne).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getReport', () => {
    it('should call branchesService.getReport with id and date range', async () => {
      const expected = { branchId: 'branch-1' };
      service.getReport.mockResolvedValue(expected);

      const result = await controller.getReport(
        'branch-1',
        '2024-01-01',
        '2024-01-31',
      );

      expect(service.getReport).toHaveBeenCalledWith(
        'branch-1',
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getComparison', () => {
    it('should call branchesService.getComparison with the date range', async () => {
      const expected = { branches: [] };
      service.getComparison.mockResolvedValue(expected);

      const result = await controller.getComparison(
        '2024-01-01',
        '2024-01-31',
      );

      expect(service.getComparison).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('should call branchesService.create with the dto', async () => {
      const dto = { name: 'Main', code: 'MB-01' };
      const expected = { id: 'branch-1', ...dto };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should call branchesService.update with id and dto', async () => {
      const dto = { name: 'Updated' };
      const expected = { id: 'branch-1', ...dto };
      service.update.mockResolvedValue(expected);

      const result = await controller.update('branch-1', dto as any);

      expect(service.update).toHaveBeenCalledWith('branch-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('should call branchesService.deactivate with the id', async () => {
      const expected = { id: 'branch-1', isActive: false };
      service.deactivate.mockResolvedValue(expected);

      const result = await controller.remove('branch-1');

      expect(service.deactivate).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(expected);
    });
  });
});
