import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from '../services/warehouses.service';

const mockWarehousesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getWarehouseStock: jest.fn(),
  deactivate: jest.fn(),
});

describe('WarehousesController', () => {
  let controller: WarehousesController;
  let service: ReturnType<typeof mockWarehousesService>;

  beforeEach(async () => {
    service = mockWarehousesService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [{ provide: WarehousesService, useValue: service }],
    }).compile();

    controller = module.get<WarehousesController>(WarehousesController);
  });

  describe('create', () => {
    it('should call warehousesService.create with the dto', async () => {
      const dto = { name: 'Main Warehouse' } as any;
      service.create.mockResolvedValue({ id: 'wh-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'wh-1', ...dto });
    });
  });

  describe('findAll', () => {
    it('should call warehousesService.findAll', async () => {
      service.findAll.mockResolvedValue([{ id: 'wh-1' }]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'wh-1' }]);
    });
  });

  describe('findOne', () => {
    it('should call warehousesService.findOne with the id', async () => {
      service.findOne.mockResolvedValue({ id: 'wh-1' });

      const result = await controller.findOne('wh-1');

      expect(service.findOne).toHaveBeenCalledWith('wh-1');
      expect(result).toEqual({ id: 'wh-1' });
    });
  });

  describe('getWarehouseStock', () => {
    it('should call warehousesService.getWarehouseStock with the id', async () => {
      service.getWarehouseStock.mockResolvedValue({ warehouse: {}, stock: [] });

      const result = await controller.getWarehouseStock('wh-1');

      expect(service.getWarehouseStock).toHaveBeenCalledWith('wh-1');
      expect(result).toEqual({ warehouse: {}, stock: [] });
    });
  });

  describe('deactivate', () => {
    it('should call warehousesService.deactivate with the id', async () => {
      service.deactivate.mockResolvedValue({ id: 'wh-1', isActive: false });

      const result = await controller.deactivate('wh-1');

      expect(service.deactivate).toHaveBeenCalledWith('wh-1');
      expect(result).toEqual({ id: 'wh-1', isActive: false });
    });
  });
});
