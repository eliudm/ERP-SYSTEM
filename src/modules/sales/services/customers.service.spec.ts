import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  contact: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('create', () => {
    const dto = { name: 'Jane Doe', email: 'jane@example.com' };

    it('should create a customer and upsert a linked contact', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const created = {
        id: 'cust-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: null,
        address: null,
        taxPin: null,
        isActive: true,
      };
      prisma.customer.create.mockResolvedValue(created);
      prisma.contact.upsert.mockResolvedValue({});

      const result = await service.create(dto as any);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(prisma.customer.create).toHaveBeenCalledWith({ data: dto });
      expect(prisma.contact.upsert).toHaveBeenCalledWith({
        where: { id: created.id },
        create: expect.objectContaining({
          id: created.id,
          type: 'INDIVIDUAL',
          name: created.name,
          email: created.email,
        }),
        update: expect.objectContaining({
          name: created.name,
          email: created.email,
        }),
      });
      expect(result).toEqual(created);
    });

    it('should throw ConflictException if email already in use', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should skip duplicate check when no email provided', async () => {
      const noEmailDto = { name: 'No Email' };
      const created = { id: 'cust-2', name: 'No Email', email: null };
      prisma.customer.create.mockResolvedValue(created);
      prisma.contact.upsert.mockResolvedValue({});

      await service.create(noEmailDto as any);

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.customer.create).toHaveBeenCalledWith({ data: noEmailDto });
    });
  });

  describe('findAll', () => {
    it('should sync contacts to customers then return paginated customers', async () => {
      prisma.contact.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Contact One',
          email: 'c1@example.com',
          phone: null,
          mobile: '0700000000',
          street: 'Main St',
          street2: null,
          city: 'Nairobi',
          state: null,
          zip: null,
          country: 'KE',
          taxId: null,
          isActive: true,
        },
      ]);
      prisma.$transaction.mockResolvedValue([{}]);
      prisma.customer.upsert.mockReturnValue('upsert-op' as any);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'Contact One' }]);

      const result = await service.findAll();

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 200,
      });
      expect(result).toEqual([{ id: 'c1', name: 'Contact One' }]);
    });

    it('should apply search filter to both contact sync and customer query', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.customer.findMany.mockResolvedValue([]);

      await service.findAll('jane', 2, 10);

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { name: { contains: 'jane', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: 'jane', mode: 'insensitive' } },
            { email: { contains: 'jane', mode: 'insensitive' } },
            { phone: { contains: 'jane', mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 10,
      });
    });

    it('should not call $transaction when there are no contacts to sync', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.customer.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should sync the single contact then return the customer with recent invoices', async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Jane',
        email: 'jane@example.com',
        phone: null,
        mobile: null,
        street: null,
        street2: null,
        city: null,
        state: null,
        zip: null,
        country: null,
        taxId: null,
        isActive: true,
      });
      prisma.customer.upsert.mockResolvedValue({});
      const customer = { id: 'cust-1', name: 'Jane', invoices: [] };
      prisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.findOne('cust-1');

      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
      });
      expect(prisma.customer.upsert).toHaveBeenCalled();
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        include: { invoices: { orderBy: { createdAt: 'desc' }, take: 10 } },
      });
      expect(result).toEqual(customer);
    });

    it('should skip customer upsert when the contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', invoices: [] });

      await service.findOne('cust-1');

      expect(prisma.customer.upsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if customer not found', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update the customer and upsert the linked contact', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      const updated = {
        id: 'cust-1',
        name: 'New Name',
        email: 'new@example.com',
        phone: null,
        address: null,
        taxPin: null,
        isActive: true,
      };
      prisma.customer.update.mockResolvedValue(updated);
      prisma.contact.upsert.mockResolvedValue({});

      const result = await service.update('cust-1', { name: 'New Name' } as any);

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { name: 'New Name' },
      });
      expect(prisma.contact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: updated.id } }),
      );
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should set customer and contact isActive to false', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      const updated = { id: 'cust-1', isActive: false };
      prisma.customer.update.mockResolvedValue(updated);
      prisma.contact.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deactivate('cust-1');

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { isActive: false },
      });
      expect(prisma.contact.updateMany).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { isActive: false },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatement', () => {
    it('should compute billing summary from non-void invoices', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);
      const customer = {
        id: 'cust-1',
        invoices: [
          { total: 100, status: 'PAID' },
          { total: 50, status: 'APPROVED' },
        ],
      };
      prisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.getStatement('cust-1');

      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        include: {
          invoices: {
            where: { status: { not: 'VOID' } },
            include: { items: true },
            orderBy: { invoiceDate: 'asc' },
          },
        },
      });
      expect(result.summary).toEqual({
        totalInvoices: 2,
        totalBilled: 150,
        totalPaid: 100,
        outstandingBalance: 50,
      });
    });

    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.getStatement('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
