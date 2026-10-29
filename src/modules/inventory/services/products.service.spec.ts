import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../../prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const mockPrisma = () => ({
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  productCategory: {
    findUnique: jest.fn(),
  },
});

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    const dto = { code: 'P-1', name: 'Widget' } as any;

    it('should create a product when code is unique and no category given', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      const expected = { id: 'prod-1', ...dto };
      prisma.product.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: dto,
        include: { category: true },
      });
      expect(result).toEqual(expected);
    });

    it('should create a product when categoryId is valid', async () => {
      const dtoWithCategory = { ...dto, categoryId: 'cat-1' };
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.productCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.product.create.mockResolvedValue({
        id: 'prod-1',
        ...dtoWithCategory,
      });

      await service.create(dtoWithCategory);

      expect(prisma.productCategory.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
      expect(prisma.product.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if code already exists', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if categoryId not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.productCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...dto, categoryId: 'missing' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should use default pagination and isActive filter', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { category: true },
        orderBy: { code: 'asc' },
        skip: 0,
        take: 200,
      });
    });

    it('should apply search, categoryId and custom pagination', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: '1' }]);

      const result = await service.findAll('widget', 'cat-1', 3, 10);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          categoryId: 'cat-1',
          OR: [
            { name: { contains: 'widget', mode: 'insensitive' } },
            { code: { contains: 'widget', mode: 'insensitive' } },
          ],
        },
        include: { category: true },
        orderBy: { code: 'asc' },
        skip: 20,
        take: 10,
      });
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('findOne', () => {
    it('should return a product with recent stock movements', async () => {
      const product = { id: 'prod-1', name: 'Widget' };
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findOne('prod-1');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: {
          category: true,
          stockMovements: {
            include: { warehouse: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      expect(result).toEqual(product);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByBarcode', () => {
    it('should return a product by barcode', async () => {
      const product = { id: 'prod-1', barcode: '12345' };
      prisma.product.findFirst.mockResolvedValue(product);

      const result = await service.findByBarcode('12345');

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { barcode: '12345' },
        include: { category: true },
      });
      expect(result).toEqual(product);
    });

    it('should throw NotFoundException if no product has the barcode', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findByBarcode('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      const updated = { id: 'prod-1', name: 'New Name' };
      prisma.product.update.mockResolvedValue(updated);

      const result = await service.update('prod-1', {
        name: 'New Name',
      } as any);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { name: 'New Name' },
        include: { category: true },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if categoryId not found', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.productCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.update('prod-1', { categoryId: 'missing' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.product.update.mockResolvedValue({
        id: 'prod-1',
        isActive: false,
      });

      const result = await service.deactivate('prod-1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLowStock', () => {
    it('should return only products at or below reorder level', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: '1', stockQuantity: 5, reorderLevel: 10 },
        { id: '2', stockQuantity: 20, reorderLevel: 10 },
        { id: '3', stockQuantity: 10, reorderLevel: 10 },
      ]);

      const result = await service.getLowStock();

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result.map((p) => p.id)).toEqual(['1', '3']);
    });
  });

  describe('getStockValuation', () => {
    it('should compute per-product retail and cost value, plus totals', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: '1',
          code: 'A',
          name: 'A',
          stockQuantity: 10,
          unitPrice: 5,
          costPrice: 3,
        },
        {
          id: '2',
          code: 'B',
          name: 'B',
          stockQuantity: 2,
          unitPrice: 50,
          costPrice: null,
        },
      ]);

      const result = await service.getStockValuation();

      expect(result.items).toEqual([
        {
          id: '1',
          code: 'A',
          name: 'A',
          stockQuantity: 10,
          unitPrice: 5,
          costPrice: 3,
          retailValue: 50,
          costValue: 30,
        },
        {
          id: '2',
          code: 'B',
          name: 'B',
          stockQuantity: 2,
          unitPrice: 50,
          costPrice: 0,
          retailValue: 100,
          costValue: 0,
        },
      ]);
      expect(result.totalRetailValue).toBe(150);
      expect(result.totalCostValue).toBe(30);
    });
  });
});
