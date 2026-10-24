import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  contact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  describe('findAll', () => {
    it('should return active contacts ordered by name', async () => {
      prisma.contact.findMany.mockResolvedValue([{ id: '1' }]);

      const result = await service.findAll();

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('should filter by type', async () => {
      prisma.contact.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'COMPANY' as any);

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, type: 'COMPANY' },
        }),
      );
    });

    it('should apply a search filter across name, email, phone and city', async () => {
      prisma.contact.findMany.mockResolvedValue([]);

      await service.findAll('acme');

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: [
              { name: { contains: 'acme', mode: 'insensitive' } },
              { email: { contains: 'acme', mode: 'insensitive' } },
              { phone: { contains: 'acme', mode: 'insensitive' } },
              { city: { contains: 'acme', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a contact by id', async () => {
      const contact = { id: 'c1', name: 'Jane' };
      prisma.contact.findUnique.mockResolvedValue(contact);

      const result = await service.findOne('c1');

      expect(prisma.contact.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' } }),
      );
      expect(result).toEqual(contact);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '12345',
    };

    it('should create a contact defaulting type to INDIVIDUAL and tags to []', async () => {
      const created = {
        id: 'c1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '12345',
        mobile: null,
        street: null,
        street2: null,
        city: null,
        state: null,
        zip: null,
        country: null,
        taxId: null,
        isActive: true,
      };
      prisma.contact.create.mockResolvedValue(created);
      prisma.customer.upsert.mockResolvedValue({});

      const result = await service.create(dto as any);

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INDIVIDUAL',
            name: 'Jane Doe',
            companyId: null,
            email: 'jane@example.com',
            phone: '12345',
            tags: [],
          }),
        }),
      );
      expect(result).toEqual(created);
    });

    it('should sync the created contact to a customer record', async () => {
      const created = {
        id: 'c1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '12345',
        mobile: null,
        street: '1 Main St',
        street2: null,
        city: 'Nairobi',
        state: null,
        zip: null,
        country: 'KE',
        taxId: 'TAX1',
        isActive: true,
      };
      prisma.contact.create.mockResolvedValue(created);
      prisma.customer.upsert.mockResolvedValue({});

      await service.create(dto as any);

      expect(prisma.customer.upsert).toHaveBeenCalledWith({
        where: { id: 'c1' },
        create: expect.objectContaining({
          id: 'c1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '12345',
          address: '1 Main St, Nairobi, KE',
          taxPin: 'TAX1',
          isActive: true,
        }),
        update: expect.objectContaining({
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '12345',
          address: '1 Main St, Nairobi, KE',
          taxPin: 'TAX1',
          isActive: true,
        }),
      });
    });

    it('should use companyId when provided', async () => {
      prisma.contact.create.mockResolvedValue({
        id: 'c2',
        name: 'Acme Branch',
        isActive: true,
      });
      prisma.customer.upsert.mockResolvedValue({});

      await service.create({ name: 'Acme Branch', companyId: 'comp-1' } as any);

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'comp-1' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields and sync to customer', async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: 'c1' });
      const updated = {
        id: 'c1',
        name: 'New Name',
        email: 'new@example.com',
        isActive: true,
      };
      prisma.contact.update.mockResolvedValue(updated);
      prisma.customer.upsert.mockResolvedValue({});

      const result = await service.update('c1', { name: 'New Name' });

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: { name: 'New Name' },
        }),
      );
      expect(prisma.customer.upsert).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if contact does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deactivate the contact and the linked customer', async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: 'c1' });
      const deactivated = { id: 'c1', isActive: false };
      prisma.contact.update.mockResolvedValue(deactivated);
      prisma.customer.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.remove('c1');

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isActive: false },
      });
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isActive: false },
      });
      expect(result).toEqual(deactivated);
    });
  });

  describe('getCompanies', () => {
    it('should return company-type contacts', async () => {
      prisma.contact.findMany.mockResolvedValue([{ id: 'comp-1' }]);

      const result = await service.getCompanies();

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'COMPANY', isActive: true },
        }),
      );
      expect(result).toEqual([{ id: 'comp-1' }]);
    });

    it('should apply a search filter on name', async () => {
      prisma.contact.findMany.mockResolvedValue([]);

      await service.getCompanies('acme');

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: 'COMPANY',
            isActive: true,
            name: { contains: 'acme', mode: 'insensitive' },
          },
        }),
      );
    });
  });
});
