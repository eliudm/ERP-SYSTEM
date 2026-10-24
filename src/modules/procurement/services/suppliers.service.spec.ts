import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../../prisma.service';

const mockPrisma = () => ({
  supplier: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  describe('create', () => {
    const dto = { name: 'Acme', email: 'acme@example.com' };

    it('should create a supplier when email is not taken', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      const expected = { id: 'sup-1', ...dto };
      prisma.supplier.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { email: 'acme@example.com' },
      });
      expect(prisma.supplier.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toBe(expected);
    });

    it('should create a supplier without checking email when none is provided', async () => {
      const noEmailDto = { name: 'Acme' };
      const expected = { id: 'sup-1', ...noEmailDto };
      prisma.supplier.create.mockResolvedValue(expected);

      const result = await service.create(noEmailDto as any);

      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.supplier.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return active suppliers ordered by name', async () => {
      prisma.supplier.findMany.mockResolvedValue([{ id: 'sup-1' }]);

      const result = await service.findAll();

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: 'sup-1' }]);
    });

    it('should apply a search filter when provided', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await service.findAll('acme');

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: 'acme', mode: 'insensitive' } },
            { email: { contains: 'acme', mode: 'insensitive' } },
            { phone: { contains: 'acme', mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a supplier with recent purchase orders', async () => {
      const expected = { id: 'sup-1', purchaseOrders: [] };
      prisma.supplier.findUnique.mockResolvedValue(expected);

      const result = await service.findOne('sup-1');

      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 } },
      });
      expect(result).toBe(expected);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing supplier', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1' });
      const dto = { name: 'New Name' };
      const expected = { id: 'sup-1', name: 'New Name' };
      prisma.supplier.update.mockResolvedValue(expected);

      const result = await service.update('sup-1', dto as any);

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: dto,
      });
      expect(result).toBe(expected);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1' });
      const expected = { id: 'sup-1', isActive: false };
      prisma.supplier.update.mockResolvedValue(expected);

      const result = await service.deactivate('sup-1');

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: { isActive: false },
      });
      expect(result).toBe(expected);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatement', () => {
    it('should compute order totals excluding VOID orders', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 'sup-1',
        purchaseOrders: [
          { status: 'RECEIVED', total: 100 },
          { status: 'APPROVED', total: 50 },
        ],
      });

      const result = await service.getStatement('sup-1');

      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        include: {
          purchaseOrders: {
            where: { status: { not: 'VOID' } },
            orderBy: { orderDate: 'asc' },
          },
        },
      });
      expect(result.summary).toEqual({
        totalOrders: 2,
        totalOrdered: 150,
        totalReceived: 100,
        pendingValue: 50,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.getStatement('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
