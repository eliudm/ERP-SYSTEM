import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from '../services/stock-movements.service';

const mockStockMovementsService = () => ({
  create: jest.fn(),
  bulkImportStock: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findOne: jest.fn(),
  adjust: jest.fn(),
});

describe('StockMovementsController', () => {
  let controller: StockMovementsController;
  let service: ReturnType<typeof mockStockMovementsService>;

  beforeEach(async () => {
    service = mockStockMovementsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementsController],
      providers: [{ provide: StockMovementsService, useValue: service }],
    }).compile();

    controller = module.get<StockMovementsController>(StockMovementsController);
  });

  describe('create', () => {
    it('should call stockMovementsService.create with the dto', async () => {
      const dto = { productId: 'prod-1', warehouseId: 'wh-1' } as any;
      service.create.mockResolvedValue({ id: 'mov-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'mov-1', ...dto });
    });
  });

  describe('bulkImport', () => {
    it('should call stockMovementsService.bulkImportStock with the parsed rows', async () => {
      const dto = { rows: [{ productCode: 'SKU1', quantity: 5 }] } as any;
      service.bulkImportStock.mockResolvedValue({
        imported: 1,
        failed: 0,
        errors: [],
      });

      const result = await controller.bulkImport(dto);

      expect(service.bulkImportStock).toHaveBeenCalledWith(dto.rows);
      expect(result).toEqual({ imported: 1, failed: 0, errors: [] });
    });
  });

  describe('findAll', () => {
    it('should parse page/limit and pass productId through', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      const result = await controller.findAll('2', '50', 'prod-1');

      expect(service.findAll).toHaveBeenCalledWith(2, 50, 'prod-1');
      expect(result).toEqual({ data: [], meta: {} });
    });

    it('should default page to 1 and limit to 20 when not provided', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(
        undefined as any,
        undefined as any,
        undefined as any,
      );

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('getSummary', () => {
    it('should call stockMovementsService.getSummary with the date range', async () => {
      service.getSummary.mockResolvedValue({ totalMovements: 0 });

      const result = await controller.getSummary('2024-01-01', '2024-01-31');

      expect(service.getSummary).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toEqual({ totalMovements: 0 });
    });
  });

  describe('findOne', () => {
    it('should call stockMovementsService.findOne with the id', async () => {
      service.findOne.mockResolvedValue({ id: 'mov-1' });

      const result = await controller.findOne('mov-1');

      expect(service.findOne).toHaveBeenCalledWith('mov-1');
      expect(result).toEqual({ id: 'mov-1' });
    });
  });

  describe('adjust', () => {
    it('should call stockMovementsService.adjust with the body fields', async () => {
      const body = {
        productId: 'prod-1',
        warehouseId: 'wh-1',
        newQuantity: 15,
        reason: 'recount',
      };
      service.adjust.mockResolvedValue({ id: 'mov-1' });

      const result = await controller.adjust(body);

      expect(service.adjust).toHaveBeenCalledWith(
        'prod-1',
        'wh-1',
        15,
        'recount',
      );
      expect(result).toEqual({ id: 'mov-1' });
    });
  });
});
