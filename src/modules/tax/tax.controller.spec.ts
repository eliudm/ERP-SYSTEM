import { Test, TestingModule } from '@nestjs/testing';
import { TaxController } from './tax.controller';
import { TaxRatesService } from './services/tax-rates.service';
import { TaxGroupsService } from './services/tax-groups.service';
import { TaxReportService } from './services/tax-report.service';

const mockTaxRatesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  setDefault: jest.fn(),
  deactivate: jest.fn(),
});

const mockTaxGroupsService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const mockTaxReportService = () => ({
  getVatReturn: jest.fn(),
  getWhtReport: jest.fn(),
  getTaxSummary: jest.fn(),
});

describe('TaxController', () => {
  let controller: TaxController;
  let taxRatesService: ReturnType<typeof mockTaxRatesService>;
  let taxGroupsService: ReturnType<typeof mockTaxGroupsService>;
  let taxReportService: ReturnType<typeof mockTaxReportService>;

  beforeEach(async () => {
    taxRatesService = mockTaxRatesService();
    taxGroupsService = mockTaxGroupsService();
    taxReportService = mockTaxReportService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        { provide: TaxRatesService, useValue: taxRatesService },
        { provide: TaxGroupsService, useValue: taxGroupsService },
        { provide: TaxReportService, useValue: taxReportService },
      ],
    }).compile();

    controller = module.get<TaxController>(TaxController);
  });

  describe('createRate', () => {
    it('should delegate to taxRatesService.create with the body', async () => {
      const body = { name: 'VAT 16%', rate: 16, type: 'VAT' };
      const expected = { id: 'rate-1', ...body };
      taxRatesService.create.mockResolvedValue(expected);

      const result = await controller.createRate(body);

      expect(taxRatesService.create).toHaveBeenCalledWith(body);
      expect(result).toEqual(expected);
    });
  });

  describe('findAllRates', () => {
    it('should default activeOnly to true when not explicitly "false"', async () => {
      taxRatesService.findAll.mockResolvedValue([]);

      await controller.findAllRates('VAT', undefined);

      expect(taxRatesService.findAll).toHaveBeenCalledWith('VAT', true);
    });

    it('should pass activeOnly=false when query string is "false"', async () => {
      taxRatesService.findAll.mockResolvedValue([]);

      await controller.findAllRates(undefined, 'false');

      expect(taxRatesService.findAll).toHaveBeenCalledWith(undefined, false);
    });
  });

  describe('findOneRate', () => {
    it('should delegate to taxRatesService.findOne with the id', async () => {
      const expected = { id: 'rate-1', name: 'VAT 16%' };
      taxRatesService.findOne.mockResolvedValue(expected);

      const result = await controller.findOneRate('rate-1');

      expect(taxRatesService.findOne).toHaveBeenCalledWith('rate-1');
      expect(result).toEqual(expected);
    });
  });

  describe('updateRate', () => {
    it('should delegate to taxRatesService.update with id and body', async () => {
      const body = { name: 'Updated' };
      const expected = { id: 'rate-1', ...body };
      taxRatesService.update.mockResolvedValue(expected);

      const result = await controller.updateRate('rate-1', body);

      expect(taxRatesService.update).toHaveBeenCalledWith('rate-1', body);
      expect(result).toEqual(expected);
    });
  });

  describe('setDefaultRate', () => {
    it('should delegate to taxRatesService.setDefault with the id', async () => {
      const expected = { id: 'rate-1', isDefault: true };
      taxRatesService.setDefault.mockResolvedValue(expected);

      const result = await controller.setDefaultRate('rate-1');

      expect(taxRatesService.setDefault).toHaveBeenCalledWith('rate-1');
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateRate', () => {
    it('should delegate to taxRatesService.deactivate with the id', async () => {
      const expected = { id: 'rate-1', isActive: false };
      taxRatesService.deactivate.mockResolvedValue(expected);

      const result = await controller.deactivateRate('rate-1');

      expect(taxRatesService.deactivate).toHaveBeenCalledWith('rate-1');
      expect(result).toEqual(expected);
    });
  });

  describe('createGroup', () => {
    it('should delegate to taxGroupsService.create with the body', async () => {
      const body = { name: 'Standard', taxRateIds: ['rate-1'] };
      const expected = { id: 'group-1', ...body };
      taxGroupsService.create.mockResolvedValue(expected);

      const result = await controller.createGroup(body);

      expect(taxGroupsService.create).toHaveBeenCalledWith(body);
      expect(result).toEqual(expected);
    });
  });

  describe('findAllGroups', () => {
    it('should delegate to taxGroupsService.findAll', async () => {
      const expected = [{ id: 'group-1' }];
      taxGroupsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAllGroups();

      expect(taxGroupsService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('findOneGroup', () => {
    it('should delegate to taxGroupsService.findOne with the id', async () => {
      const expected = { id: 'group-1' };
      taxGroupsService.findOne.mockResolvedValue(expected);

      const result = await controller.findOneGroup('group-1');

      expect(taxGroupsService.findOne).toHaveBeenCalledWith('group-1');
      expect(result).toEqual(expected);
    });
  });

  describe('updateGroup', () => {
    it('should delegate to taxGroupsService.update with id and body', async () => {
      const body = { name: 'Renamed' };
      const expected = { id: 'group-1', ...body };
      taxGroupsService.update.mockResolvedValue(expected);

      const result = await controller.updateGroup('group-1', body);

      expect(taxGroupsService.update).toHaveBeenCalledWith('group-1', body);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteGroup', () => {
    it('should delegate to taxGroupsService.delete with the id', async () => {
      const expected = { id: 'group-1' };
      taxGroupsService.delete.mockResolvedValue(expected);

      const result = await controller.deleteGroup('group-1');

      expect(taxGroupsService.delete).toHaveBeenCalledWith('group-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getVatReturn', () => {
    it('should delegate to taxReportService.getVatReturn with the date range', async () => {
      const expected = { vatPayable: 100 };
      taxReportService.getVatReturn.mockResolvedValue(expected);

      const result = await controller.getVatReturn('2025-01-01', '2025-01-31');

      expect(taxReportService.getVatReturn).toHaveBeenCalledWith(
        '2025-01-01',
        '2025-01-31',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getWhtReport', () => {
    it('should delegate to taxReportService.getWhtReport with the date range', async () => {
      const expected = { totalWithholding: 500 };
      taxReportService.getWhtReport.mockResolvedValue(expected);

      const result = await controller.getWhtReport('2025-01-01', '2025-01-31');

      expect(taxReportService.getWhtReport).toHaveBeenCalledWith(
        '2025-01-01',
        '2025-01-31',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getTaxSummary', () => {
    it('should delegate to taxReportService.getTaxSummary with the year parsed as a number', async () => {
      const expected = { year: 2025 };
      taxReportService.getTaxSummary.mockResolvedValue(expected);

      const result = await controller.getTaxSummary('2025');

      expect(taxReportService.getTaxSummary).toHaveBeenCalledWith(2025);
      expect(result).toEqual(expected);
    });
  });
});
