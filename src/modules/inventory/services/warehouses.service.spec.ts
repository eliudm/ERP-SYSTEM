import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../../../prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  warehouse: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  stockMovement: {
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
});

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  describe('create', () => {
    it('should create a warehouse with the given dto', async () => {
      const dto = { name: 'Main Warehouse' } as any;
      const expected = { id: 'wh-1', ...dto };
      prisma.warehouse.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.warehouse.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return active warehouses ordered by name', async () => {
      prisma.warehouse.findMany.mockResolvedValue([{ id: '1' }]);

      const result = await service.findAll();

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('findOne', () => {
    it('should return a warehouse with recent stock movements', async () => {
      const warehouse = { id: 'wh-1', name: 'Main' };
      prisma.warehouse.findUnique.mockResolvedValue(warehouse);

      const result = await service.findOne('wh-1');

      expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
        include: {
          stockMovements: {
            include: { product: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
      expect(result).toEqual(warehouse);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWarehouseStock', () => {
    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.getWarehouseStock('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return aggregated net stock per product', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.stockMovement.groupBy.mockResolvedValue([{ productId: 'prod-1' }]);
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        unitPrice: 10,
      });
      prisma.stockMovement.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 30 } }) // IN
        .mockResolvedValueOnce({ _sum: { quantity: 10 } }); // OUT

      const result = await service.getWarehouseStock('wh-1');

      expect(prisma.stockMovement.groupBy).toHaveBeenCalledWith({
        by: ['productId'],
        where: { warehouseId: 'wh-1' },
        _sum: { quantity: true },
      });
      expect(result.stock).toEqual([
        {
          product: { id: 'prod-1', unitPrice: 10 },
          netStock: 20,
          totalValue: 200,
        },
      ]);
      expect(result.warehouse).toEqual({ id: 'wh-1' });
    });

    it('should treat missing aggregate sums as zero', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.stockMovement.groupBy.mockResolvedValue([{ productId: 'prod-1' }]);
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.stockMovement.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: null } })
        .mockResolvedValueOnce({ _sum: { quantity: null } });

      const result = await service.getWarehouseStock('wh-1');

      expect(result.stock).toEqual([
        { product: null, netStock: 0, totalValue: 0 },
      ]);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.warehouse.update.mockResolvedValue({
        id: 'wh-1',
        isActive: false,
      });

      const result = await service.deactivate('wh-1');

      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
