import { Test, TestingModule } from '@nestjs/testing';
import { BomService } from './bom.service';
import { PrismaService } from '../../../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  billOfMaterial: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bOMLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('BomService', () => {
  let service: BomService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BomService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BomService>(BomService);
  });

  describe('create', () => {
    const dto = {
      name: 'Test BOM',
      productId: 'prod-1',
      quantity: 1,
      lines: [
        { productId: 'comp-1', quantity: 2 },
        { productId: 'comp-2', quantity: 3 },
      ],
    };

    it('should create a BOM with lines', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.product.findMany.mockResolvedValue([
        { id: 'comp-1' },
        { id: 'comp-2' },
      ]);
      const expected = { id: 'bom-1', ...dto };
      prisma.billOfMaterial.create.mockResolvedValue(expected);

      const result = await service.create(dto, 'user-1');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(prisma.billOfMaterial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test BOM',
            productId: 'prod-1',
            createdById: 'user-1',
          }),
        }),
      );
      expect(result).toEqual(expected);
    });

    it('should throw if finished product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw if product is a component of itself', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      const selfRefDto = {
        ...dto,
        lines: [{ productId: 'prod-1', quantity: 1 }],
      };

      await expect(service.create(selfRefDto)).rejects.toThrow(
        'A product cannot be a component of itself',
      );
    });

    it('should throw if some component products not found', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.product.findMany.mockResolvedValue([{ id: 'comp-1' }]); // missing comp-2

      await expect(service.create(dto)).rejects.toThrow(
        'One or more component products not found',
      );
    });
  });

  describe('findAll', () => {
    it('should return all BOMs without filter', async () => {
      const boms = [{ id: '1' }, { id: '2' }];
      prisma.billOfMaterial.findMany.mockResolvedValue(boms);

      const result = await service.findAll();

      expect(prisma.billOfMaterial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual(boms);
    });

    it('should filter by status', async () => {
      prisma.billOfMaterial.findMany.mockResolvedValue([]);

      await service.findAll('ACTIVE');

      expect(prisma.billOfMaterial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a BOM by id', async () => {
      const bom = { id: 'bom-1', name: 'Test' };
      prisma.billOfMaterial.findUnique.mockResolvedValue(bom);

      const result = await service.findOne('bom-1');
      expect(result).toEqual(bom);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update BOM metadata', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({ id: 'bom-1' });
      prisma.billOfMaterial.update.mockResolvedValue({
        id: 'bom-1',
        name: 'Updated',
      });

      const result = await service.update('bom-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if BOM not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setStatus', () => {
    it('should update the BOM status', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({ id: 'bom-1' });
      prisma.billOfMaterial.update.mockResolvedValue({
        id: 'bom-1',
        status: 'ACTIVE',
      });

      const result = await service.setStatus('bom-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw NotFoundException if BOM not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.setStatus('missing', 'ACTIVE')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertLines', () => {
    const lines = [
      { productId: 'comp-1', quantity: 5 },
      { productId: 'comp-2', quantity: 3 },
    ];

    it('should replace BOM lines in a transaction', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        productId: 'prod-1',
      });

      const txMock = {
        bOMLine: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        billOfMaterial: {
          findUnique: jest.fn().mockResolvedValue({ id: 'bom-1', lines }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(txMock));

      const result = await service.upsertLines('bom-1', lines);

      expect(txMock.bOMLine.deleteMany).toHaveBeenCalledWith({
        where: { bomId: 'bom-1' },
      });
      expect(txMock.bOMLine.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ bomId: 'bom-1', productId: 'comp-1' }),
        ]),
      });
      expect(result).toBeTruthy();
    });

    it('should throw if BOM not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.upsertLines('missing', lines)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if a line references the finished product', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        productId: 'prod-1',
      });

      const selfRefLines = [{ productId: 'prod-1', quantity: 1 }];

      await expect(service.upsertLines('bom-1', selfRefLines)).rejects.toThrow(
        'A product cannot be a component of itself',
      );
    });
  });

  describe('checkAvailability', () => {
    it('should return availability with sufficient stock', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        name: 'Test BOM',
        lines: [
          {
            quantity: 2,
            product: {
              id: 'comp-1',
              code: 'C1',
              name: 'Component 1',
              stockQuantity: 100,
            },
          },
        ],
      });

      const result = await service.checkAvailability('bom-1', 5);

      expect(result.allAvailable).toBe(true);
      expect(result.components[0].requiredQty).toBe(10);
      expect(result.components[0].availableQty).toBe(100);
      expect(result.components[0].shortage).toBe(0);
    });

    it('should flag shortage when insufficient stock', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue({
        id: 'bom-1',
        name: 'Test BOM',
        lines: [
          {
            quantity: 10,
            product: {
              id: 'comp-1',
              code: 'C1',
              name: 'Component 1',
              stockQuantity: 5,
            },
          },
        ],
      });

      const result = await service.checkAvailability('bom-1', 3);

      expect(result.allAvailable).toBe(false);
      expect(result.components[0].shortage).toBe(25); // need 30, have 5
      expect(result.components[0].isSufficient).toBe(false);
    });

    it('should throw NotFoundException if BOM not found', async () => {
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      await expect(service.checkAvailability('missing', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
