import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MovementType } from '@prisma/client';

const mockTx = () => ({
  stockMovement: { create: jest.fn() },
  product: { update: jest.fn() },
});

const mockPrisma = () => ({
  product: { findUnique: jest.fn(), update: jest.fn() },
  warehouse: { findUnique: jest.fn() },
  stockMovement: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  account: { findFirst: jest.fn() },
  $transaction: jest.fn(),
});

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: { postTransaction: jest.Mock };
  let notificationsService: { checkAndNotifyLowStock: jest.Mock };
  let tx: ReturnType<typeof mockTx>;

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = { postTransaction: jest.fn().mockResolvedValue({}) };
    notificationsService = {
      checkAndNotifyLowStock: jest.fn().mockResolvedValue(undefined),
    };
    tx = mockTx();
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
  });

  describe('create', () => {
    const product = { id: 'prod-1', stockQuantity: 50, unitPrice: 20 };
    const warehouse = { id: 'wh-1' };

    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse);
      prisma.account.findFirst
        .mockResolvedValueOnce({ id: 'acc-1' })
        .mockResolvedValueOnce({ id: 'acc-2' });
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          productId: 'missing',
          warehouseId: 'wh-1',
          movementType: MovementType.IN,
          quantity: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          productId: 'prod-1',
          warehouseId: 'missing',
          movementType: MovementType.IN,
          quantity: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if OUT quantity exceeds available stock', async () => {
      await expect(
        service.create({
          productId: 'prod-1',
          warehouseId: 'wh-1',
          movementType: MovementType.OUT,
          quantity: 100,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should record an IN movement, increment stock and post accounting', async () => {
      const dto = {
        productId: 'prod-1',
        warehouseId: 'wh-1',
        movementType: MovementType.IN,
        quantity: 10,
        unitCost: 5,
        reference: 'REF1',
      } as any;
      const createdMovement = { id: 'mov-1', ...dto };
      tx.stockMovement.create.mockResolvedValue(createdMovement);

      const result = await service.create(dto);

      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          warehouseId: 'wh-1',
          movementType: MovementType.IN,
          quantity: 10,
          unitCost: 5,
          reference: 'REF1',
          notes: undefined,
        },
        include: { product: true, warehouse: true },
      });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 10 } },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'ACC-REF1',
          sourceType: 'STOCK_IN',
          lines: [
            expect.objectContaining({ accountId: 'acc-1', debit: 50, credit: 0 }),
            expect.objectContaining({ accountId: 'acc-2', debit: 0, credit: 50 }),
          ],
        }),
      );
      expect(notificationsService.checkAndNotifyLowStock).not.toHaveBeenCalled();
      expect(result).toEqual(createdMovement);
    });

    it('should record an OUT movement, decrement stock, post COGS and check low stock', async () => {
      const dto = {
        productId: 'prod-1',
        warehouseId: 'wh-1',
        movementType: MovementType.OUT,
        quantity: 5,
        reference: 'REF2',
      } as any;
      tx.stockMovement.create.mockResolvedValue({ id: 'mov-2', ...dto });

      await service.create(dto);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: -5 } },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'ACC-REF2',
          sourceType: 'STOCK_OUT',
          lines: [
            expect.objectContaining({ accountId: 'acc-1', debit: 100, credit: 0 }),
            expect.objectContaining({ accountId: 'acc-2', debit: 0, credit: 100 }),
          ],
        }),
      );
      expect(notificationsService.checkAndNotifyLowStock).toHaveBeenCalledWith(
        'prod-1',
      );
    });

    it('should record an ADJUSTMENT movement without posting accounting entries', async () => {
      const dto = {
        productId: 'prod-1',
        warehouseId: 'wh-1',
        movementType: MovementType.ADJUSTMENT,
        quantity: 3,
        reference: 'REF3',
      } as any;
      tx.stockMovement.create.mockResolvedValue({ id: 'mov-3', ...dto });

      await service.create(dto);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: { increment: 0 } },
      });
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
      expect(notificationsService.checkAndNotifyLowStock).toHaveBeenCalledWith(
        'prod-1',
      );
    });

    it('should skip posting accounting entries when required accounts are missing', async () => {
      prisma.account.findFirst.mockReset();
      prisma.account.findFirst.mockResolvedValue(null);
      const dto = {
        productId: 'prod-1',
        warehouseId: 'wh-1',
        movementType: MovementType.IN,
        quantity: 10,
        unitCost: 5,
        reference: 'REF4',
      } as any;
      tx.stockMovement.create.mockResolvedValue({ id: 'mov-4', ...dto });

      await service.create(dto);

      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should paginate with defaults and no productId filter', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([{ id: '1' }]);
      prisma.stockMovement.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: {},
        include: { product: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.stockMovement.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: [{ id: '1' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should filter by productId and compute skip/totalPages', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(45);

      const result = await service.findAll(3, 20, 'prod-1');

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        skip: 40,
        take: 20,
        where: { productId: 'prod-1' },
        include: { product: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.meta).toEqual({
        total: 45,
        page: 3,
        limit: 20,
        totalPages: 3,
      });
    });
  });

  describe('findOne', () => {
    it('should return a movement by id', async () => {
      const movement = { id: 'mov-1' };
      prisma.stockMovement.findUnique.mockResolvedValue(movement);

      const result = await service.findOne('mov-1');

      expect(prisma.stockMovement.findUnique).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
        include: { product: true, warehouse: true },
      });
      expect(result).toEqual(movement);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.stockMovement.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adjust', () => {
    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.adjust('missing', 'wh-1', 10, 'recount'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', stockQuantity: 10 });
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.adjust('prod-1', 'missing', 10, 'recount'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should record the adjustment and set the new stock quantity', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', stockQuantity: 10 });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      const movement = { id: 'mov-1', quantity: 5 };
      tx.stockMovement.create.mockResolvedValue(movement);

      const result = await service.adjust('prod-1', 'wh-1', 15, 'recount');

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            warehouseId: 'wh-1',
            movementType: MovementType.ADJUSTMENT,
            quantity: 5,
          }),
        }),
      );
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQuantity: 15 },
      });
      expect(result).toEqual(movement);
    });
  });

  describe('getSummary', () => {
    it('should aggregate totals by movement type', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([
        { movementType: 'IN', quantity: 10 },
        { movementType: 'IN', quantity: 5 },
        { movementType: 'OUT', quantity: 3 },
        { movementType: 'ADJUSTMENT', quantity: 1 },
      ]);

      const result = await service.getSummary('2024-01-01', '2024-01-31');

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
        },
        include: { product: true },
      });
      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalMovements: 4,
        totalIn: 15,
        totalOut: 3,
        totalAdjustments: 1,
      });
    });
  });
});
