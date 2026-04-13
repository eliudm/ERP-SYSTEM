import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrderService } from './work-order.service';
import { PrismaService } from '../../../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  billOfMaterial: {
    findUnique: jest.fn(),
  },
  workOrder: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  product: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkOrderService>(WorkOrderService);
  });

  describe('create', () => {
    const dto = { bomId: 'bom-1', quantity: 5 };

    it('should create a work order with auto-generated reference', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        status: 'ACTIVE',
        product: { id: 'p1' },
      });
      prisma.workOrder.count.mockResolvedValue(42);
      const expected = { id: 'wo-1', reference: 'WO-00043' };
      prisma.workOrder.create.mockResolvedValue(expected);

      const result = await service.create(dto, 'user-1');

      expect(prisma.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reference: 'WO-00043',
            bomId: 'bom-1',
            quantity: 5,
            createdById: 'user-1',
          }),
        }),
      );
      expect(result).toEqual(expected);
    });

    it('should throw if BOM not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw if BOM is not ACTIVE', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        status: 'DRAFT',
      });

      await expect(service.create(dto)).rejects.toThrow(
        'BOM must be ACTIVE to create work orders',
      );
    });
  });

  describe('findAll', () => {
    it('should return all work orders', async () => {
      prisma.workOrder.findMany.mockResolvedValue([{ id: 'wo-1' }]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);

      await service.findAll('IN_PROGRESS');

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'IN_PROGRESS' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a work order', async () => {
      const wo = { id: 'wo-1', reference: 'WO-00001' };
      prisma.workOrder.findUnique.mockResolvedValue(wo);

      expect(await service.findOne('wo-1')).toEqual(wo);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirm', () => {
    it('should confirm a DRAFT work order', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'DRAFT',
      });
      prisma.workOrder.update.mockResolvedValue({
        id: 'wo-1',
        status: 'CONFIRMED',
      });

      const result = await service.confirm('wo-1');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw if not DRAFT', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'IN_PROGRESS',
      });

      await expect(service.confirm('wo-1')).rejects.toThrow(
        'Only DRAFT work orders can be confirmed',
      );
    });

    it('should throw if not found', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.confirm('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('startProduction', () => {
    const woWithBom = {
      id: 'wo-1',
      status: 'CONFIRMED',
      quantity: 2,
      bom: {
        lines: [
          {
            productId: 'comp-1',
            quantity: 5,
            product: { name: 'Comp1', stockQuantity: 100 },
          },
          {
            productId: 'comp-2',
            quantity: 3,
            product: { name: 'Comp2', stockQuantity: 50 },
          },
        ],
      },
    };

    it('should consume materials and start production', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(woWithBom);
      prisma.$transaction.mockResolvedValue([]);
      prisma.workOrder.update.mockResolvedValue({
        id: 'wo-1',
        status: 'IN_PROGRESS',
      });

      const result = await service.startProduction('wo-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw if insufficient stock', async () => {
      const lowStock = {
        ...woWithBom,
        bom: {
          lines: [
            {
              productId: 'comp-1',
              quantity: 5,
              product: { name: 'Comp1', stockQuantity: 3 },
            },
          ],
        },
      };
      prisma.workOrder.findUnique.mockResolvedValue(lowStock);

      await expect(service.startProduction('wo-1')).rejects.toThrow(
        'Insufficient stock for Comp1',
      );
    });

    it('should throw if not CONFIRMED', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'DRAFT',
        bom: { lines: [] },
      });

      await expect(service.startProduction('wo-1')).rejects.toThrow(
        'Work order must be CONFIRMED to start',
      );
    });

    it('should throw if not found', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.startProduction('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('complete', () => {
    it('should add finished goods to stock and complete', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'IN_PROGRESS',
        quantity: 3,
        bom: { productId: 'prod-1', quantity: 2 },
      });
      prisma.product.update.mockResolvedValue({});
      prisma.workOrder.update.mockResolvedValue({
        id: 'wo-1',
        status: 'DONE',
      });

      const result = await service.complete('wo-1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 6 } }, // 2 * 3
      });
      expect(result.status).toBe('DONE');
    });

    it('should throw if not IN_PROGRESS', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'CONFIRMED',
        bom: {},
      });

      await expect(service.complete('wo-1')).rejects.toThrow(
        'Work order must be IN_PROGRESS to complete',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a DRAFT work order', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'DRAFT',
      });
      prisma.workOrder.update.mockResolvedValue({
        id: 'wo-1',
        status: 'CANCELLED',
      });

      const result = await service.cancel('wo-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should reverse consumed materials when cancelling IN_PROGRESS', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'IN_PROGRESS',
        bomId: 'bom-1',
        quantity: 2,
      });
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        lines: [
          { productId: 'comp-1', quantity: 5 },
          { productId: 'comp-2', quantity: 3 },
        ],
      });
      prisma.$transaction.mockResolvedValue([]);
      prisma.workOrder.update.mockResolvedValue({
        id: 'wo-1',
        status: 'CANCELLED',
      });

      const result = await service.cancel('wo-1');

      expect(prisma.billOfMaterial.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bom-1' } }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw if already DONE', async () => {
      prisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: 'DONE',
      });

      await expect(service.cancel('wo-1')).rejects.toThrow(
        'Cannot cancel a completed work order',
      );
    });

    it('should throw if not found', async () => {
      prisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.cancel('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
