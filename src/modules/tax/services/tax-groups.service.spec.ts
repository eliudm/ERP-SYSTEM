import { Test, TestingModule } from '@nestjs/testing';
import { TaxGroupsService } from './tax-groups.service';
import { PrismaService } from '../../../prisma.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('../../../tenant-context', () => ({
  getCurrentTenantId: jest.fn(() => 'tenant-1'),
}));

const mockPrisma = () => ({
  taxGroup: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  taxRate: {
    findMany: jest.fn(),
  },
});

describe('TaxGroupsService', () => {
  let service: TaxGroupsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxGroupsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TaxGroupsService>(TaxGroupsService);
  });

  describe('create', () => {
    it('should create a tax group with tenantId attached', async () => {
      const dto = {
        name: 'Standard Group',
        description: 'VAT + WHT',
        taxRateIds: ['rate-1', 'rate-2'],
      };
      const expected = { id: 'group-1', ...dto, tenantId: 'tenant-1' };
      prisma.taxGroup.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.taxGroup.create).toHaveBeenCalledWith({
        data: { ...dto, tenantId: 'tenant-1' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should enrich each group with resolved tax rates from taxRateIds', async () => {
      prisma.taxGroup.findMany.mockResolvedValue([
        { id: 'group-1', name: 'G1', taxRateIds: ['rate-1', 'rate-2'] },
        { id: 'group-2', name: 'G2', taxRateIds: ['rate-2'] },
      ]);
      prisma.taxRate.findMany.mockResolvedValue([
        { id: 'rate-1', rate: 16 },
        { id: 'rate-2', rate: 5 },
      ]);

      const result = await service.findAll();

      expect(prisma.taxGroup.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(prisma.taxRate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual([
        {
          id: 'group-1',
          name: 'G1',
          taxRateIds: ['rate-1', 'rate-2'],
          taxRates: [
            { id: 'rate-1', rate: 16 },
            { id: 'rate-2', rate: 5 },
          ],
        },
        {
          id: 'group-2',
          name: 'G2',
          taxRateIds: ['rate-2'],
          taxRates: [{ id: 'rate-2', rate: 5 }],
        },
      ]);
    });

    it('should drop unresolved tax rate ids', async () => {
      prisma.taxGroup.findMany.mockResolvedValue([
        { id: 'group-1', name: 'G1', taxRateIds: ['rate-1', 'missing-rate'] },
      ]);
      prisma.taxRate.findMany.mockResolvedValue([{ id: 'rate-1', rate: 16 }]);

      const result = await service.findAll();

      expect(result[0].taxRates).toEqual([{ id: 'rate-1', rate: 16 }]);
    });
  });

  describe('findOne', () => {
    it('should return a group enriched with its tax rates', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'G1',
        taxRateIds: ['rate-1', 'rate-2'],
      });
      prisma.taxRate.findMany.mockResolvedValue([
        { id: 'rate-1', rate: 16 },
        { id: 'rate-2', rate: 5 },
      ]);

      const result = await service.findOne('group-1');

      expect(prisma.taxGroup.findUnique).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
      expect(prisma.taxRate.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['rate-1', 'rate-2'] } },
      });
      expect(result).toEqual({
        id: 'group-1',
        name: 'G1',
        taxRateIds: ['rate-1', 'rate-2'],
        taxRates: [
          { id: 'rate-1', rate: 16 },
          { id: 'rate-2', rate: 5 },
        ],
      });
    });

    it('should throw NotFoundException when group does not exist', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.taxRate.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should call findOne first and then update', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'G1',
        taxRateIds: [],
      });
      prisma.taxRate.findMany.mockResolvedValue([]);
      prisma.taxGroup.update.mockResolvedValue({ id: 'group-1', name: 'Renamed' });

      const result = await service.update('group-1', { name: 'Renamed' });

      expect(prisma.taxGroup.findUnique).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
      expect(prisma.taxGroup.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { name: 'Renamed' },
      });
      expect(result).toEqual({ id: 'group-1', name: 'Renamed' });
    });

    it('should throw NotFoundException if the group does not exist', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.taxGroup.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should call findOne first and then delete', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'G1',
        taxRateIds: [],
      });
      prisma.taxRate.findMany.mockResolvedValue([]);
      prisma.taxGroup.delete.mockResolvedValue({ id: 'group-1' });

      const result = await service.delete('group-1');

      expect(prisma.taxGroup.delete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
      expect(result).toEqual({ id: 'group-1' });
    });

    it('should throw NotFoundException if the group does not exist', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.taxGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe('getTotalRate', () => {
    it('should sum the rates of all tax rates in the group', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'G1',
        taxRateIds: ['rate-1', 'rate-2'],
      });
      prisma.taxRate.findMany.mockResolvedValue([
        { id: 'rate-1', rate: 16 },
        { id: 'rate-2', rate: 5.5 },
      ]);

      const result = await service.getTotalRate('group-1');

      expect(result).toBe(21.5);
    });

    it('should return 0 when the group has no tax rates', async () => {
      prisma.taxGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'Empty',
        taxRateIds: [],
      });
      prisma.taxRate.findMany.mockResolvedValue([]);

      const result = await service.getTotalRate('group-1');

      expect(result).toBe(0);
    });
  });
});
