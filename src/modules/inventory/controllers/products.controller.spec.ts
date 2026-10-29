import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from '../services/products.service';

const mockProductsService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  getLowStock: jest.fn(),
  getStockValuation: jest.fn(),
  findByBarcode: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
});

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ReturnType<typeof mockProductsService>;

  beforeEach(async () => {
    service = mockProductsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  describe('create', () => {
    it('should call productsService.create with the dto', async () => {
      const dto = { code: 'P-1', name: 'Widget' } as any;
      service.create.mockResolvedValue({ id: 'prod-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'prod-1', ...dto });
    });
  });

  describe('findAll', () => {
    it('should pass through search, categoryId and parsed page/limit', async () => {
      service.findAll.mockResolvedValue([{ id: '1' }]);

      const result = await controller.findAll('widget', 'cat-1', '2', '50');

      expect(service.findAll).toHaveBeenCalledWith('widget', 'cat-1', 2, 50);
      expect(result).toEqual([{ id: '1' }]);
    });

    it('should pass undefined page/limit when not provided', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll('widget', undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(
        'widget',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('getLowStock', () => {
    it('should call productsService.getLowStock', async () => {
      service.getLowStock.mockResolvedValue([{ id: '1' }]);

      const result = await controller.getLowStock();

      expect(service.getLowStock).toHaveBeenCalled();
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('getValuation', () => {
    it('should call productsService.getStockValuation', async () => {
      service.getStockValuation.mockResolvedValue({
        items: [],
        totalRetailValue: 0,
        totalCostValue: 0,
      });

      const result = await controller.getValuation();

      expect(service.getStockValuation).toHaveBeenCalled();
      expect(result).toEqual({
        items: [],
        totalRetailValue: 0,
        totalCostValue: 0,
      });
    });
  });

  describe('findByBarcode', () => {
    it('should call productsService.findByBarcode with the barcode', async () => {
      service.findByBarcode.mockResolvedValue({ id: 'prod-1' });

      const result = await controller.findByBarcode('12345');

      expect(service.findByBarcode).toHaveBeenCalledWith('12345');
      expect(result).toEqual({ id: 'prod-1' });
    });
  });

  describe('findOne', () => {
    it('should call productsService.findOne with the id', async () => {
      service.findOne.mockResolvedValue({ id: 'prod-1' });

      const result = await controller.findOne('prod-1');

      expect(service.findOne).toHaveBeenCalledWith('prod-1');
      expect(result).toEqual({ id: 'prod-1' });
    });
  });

  describe('update', () => {
    it('should call productsService.update with id and dto', async () => {
      const dto = { name: 'New Name' } as any;
      service.update.mockResolvedValue({ id: 'prod-1', ...dto });

      const result = await controller.update('prod-1', dto);

      expect(service.update).toHaveBeenCalledWith('prod-1', dto);
      expect(result).toEqual({ id: 'prod-1', ...dto });
    });
  });

  describe('deactivate', () => {
    it('should call productsService.deactivate with the id', async () => {
      service.deactivate.mockResolvedValue({ id: 'prod-1', isActive: false });

      const result = await controller.deactivate('prod-1');

      expect(service.deactivate).toHaveBeenCalledWith('prod-1');
      expect(result).toEqual({ id: 'prod-1', isActive: false });
    });
  });
});
