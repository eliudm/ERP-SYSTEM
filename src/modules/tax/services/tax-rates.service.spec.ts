import { Test, TestingModule } from '@nestjs/testing';
import { TaxRatesService } from './tax-rates.service';
import { PrismaService } from '../../../prisma.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('../../../tenant-context', () => ({
  getCurrentTenantId: jest.fn(() => 'tenant-1'),
}));

const mockPrisma = () => ({
  taxRate: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('TaxRatesService', () => {
  let service: TaxRatesService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxRatesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TaxRatesService>(TaxRatesService);
  });

  describe('create', () => {
    const dto = {
      name: 'VAT 16%',
      rate: 16,
      type: 'VAT',
    };

    it('should create a tax rate with tenantId attached', async () => {
      const expected = { id: 'rate-1', ...dto, tenantId: 'tenant-1' };
      prisma.taxRate.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.taxRate.updateMany).not.toHaveBeenCalled();
      expect(prisma.taxRate.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          type: 'VAT',
          tenantId: 'tenant-1',
        },
      });
      expect(result).toEqual(expected);
    });

    it('should un-default existing defaults of same type before creating when isDefault is true', async () => {
      const defaultDto = { ...dto, isDefault: true };
      prisma.taxRate.create.mockResolvedValue({ id: 'rate-2', ...defaultDto });

      await service.create(defaultDto);

      expect(prisma.taxRate.updateMany).toHaveBeenCalledWith({
        where: { type: 'VAT', isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.taxRate.create).toHaveBeenCalledWith({
        data: {
          ...defaultDto,
          type: 'VAT',
          tenantId: 'tenant-1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('should list active rates by default with no type filter', async () => {
      prisma.taxRate.findMany.mockResolvedValue([{ id: 'rate-1' }]);

      const result = await service.findAll();

      expect(prisma.taxRate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { glAccount: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: 'rate-1' }]);
    });

    it('should filter by type when provided', async () => {
      prisma.taxRate.findMany.mockResolvedValue([]);

      await service.findAll('VAT');

      expect(prisma.taxRate.findMany).toHaveBeenCalledWith({
        where: { type: 'VAT', isActive: true },
        include: { glAccount: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should omit the isActive filter when activeOnly is false', async () => {
      prisma.taxRate.findMany.mockResolvedValue([]);

      await service.findAll('VAT', false);

      expect(prisma.taxRate.findMany).toHaveBeenCalledWith({
        where: { type: 'VAT' },
        include: { glAccount: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a tax rate by id', async () => {
      const rate = { id: 'rate-1', name: 'VAT 16%' };
      prisma.taxRate.findUnique.mockResolvedValue(rate);

      const result = await service.findOne('rate-1');

      expect(prisma.taxRate.findUnique).toHaveBeenCalledWith({
        where: { id: 'rate-1' },
        include: { glAccount: true },
      });
      expect(result).toEqual(rate);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.taxRate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call findOne first and update without un-defaulting when isDefault not set', async () => {
      prisma.taxRate.findUnique.mockResolvedValue({ id: 'rate-1', type: 'VAT' });
      prisma.taxRate.update.mockResolvedValue({ id: 'rate-1', name: 'Updated' });

      const result = await service.update('rate-1', { name: 'Updated' });

      expect(prisma.taxRate.updateMany).not.toHaveBeenCalled();
      expect(prisma.taxRate.update).toHaveBeenCalledWith({
        where: { id: 'rate-1' },
        data: { name: 'Updated' },
      });
      expect(result).toEqual({ id: 'rate-1', name: 'Updated' });
    });

    it('should throw NotFoundException if the rate does not exist', async () => {
      prisma.taxRate.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should un-default other rates of the same type when isDefault is set to true', async () => {
      // First call: findOne() inside update (via this.findOne(id))
      // Second call: existing lookup for type/isDefault un-defaulting
      prisma.taxRate.findUnique
        .mockResolvedValueOnce({ id: 'rate-1', type: 'VAT' })
        .mockResolvedValueOnce({ id: 'rate-1', type: 'VAT' });
      prisma.taxRate.update.mockResolvedValue({
        id: 'rate-1',
        isDefault: true,
      });

      await service.update('rate-1', { isDefault: true });

      expect(prisma.taxRate.updateMany).toHaveBeenCalledWith({
        where: { type: 'VAT', isDefault: true, id: { not: 'rate-1' } },
        data: { isDefault: false },
      });
      expect(prisma.taxRate.update).toHaveBeenCalledWith({
        where: { id: 'rate-1' },
        data: { isDefault: true },
      });
    });
  });

  describe('setDefault', () => {
    it('should delegate to update with isDefault true', async () => {
      prisma.taxRate.findUnique.mockResolvedValue({ id: 'rate-1', type: 'VAT' });
      prisma.taxRate.update.mockResolvedValue({ id: 'rate-1', isDefault: true });

      const result = await service.setDefault('rate-1');

      expect(prisma.taxRate.update).toHaveBeenCalledWith({
        where: { id: 'rate-1' },
        data: { isDefault: true },
      });
      expect(result).toEqual({ id: 'rate-1', isDefault: true });
    });
  });

  describe('deactivate', () => {
    it('should delegate to update with isActive false', async () => {
      prisma.taxRate.findUnique.mockResolvedValue({ id: 'rate-1', type: 'VAT' });
      prisma.taxRate.update.mockResolvedValue({ id: 'rate-1', isActive: false });

      const result = await service.deactivate('rate-1');

      expect(prisma.taxRate.update).toHaveBeenCalledWith({
        where: { id: 'rate-1' },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: 'rate-1', isActive: false });
    });
  });
});
