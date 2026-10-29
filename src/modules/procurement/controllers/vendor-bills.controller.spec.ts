import { Test, TestingModule } from '@nestjs/testing';
import { VendorBillsController } from './vendor-bills.controller';
import { VendorBillsService } from '../services/vendor-bills.service';

const mockVendorBillsService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  pay: jest.fn(),
  void: jest.fn(),
});

describe('VendorBillsController', () => {
  let controller: VendorBillsController;
  let service: ReturnType<typeof mockVendorBillsService>;

  beforeEach(async () => {
    service = mockVendorBillsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorBillsController],
      providers: [{ provide: VendorBillsService, useValue: service }],
    }).compile();

    controller = module.get<VendorBillsController>(VendorBillsController);
  });

  describe('approve', () => {
    it('should call vendorBillsService.approve with the id', async () => {
      service.approve.mockResolvedValue({ id: 'bill-1', status: 'APPROVED' });

      const result = await controller.approve('bill-1');

      expect(service.approve).toHaveBeenCalledWith('bill-1');
      expect(result).toEqual({ id: 'bill-1', status: 'APPROVED' });
    });
  });

  describe('pay', () => {
    it('should call vendorBillsService.pay with the id and cashAccountId from the body', async () => {
      const dto = { cashAccountId: 'acc-cash' } as any;
      service.pay.mockResolvedValue({ id: 'bill-1', status: 'PAID' });

      const result = await controller.pay('bill-1', dto);

      expect(service.pay).toHaveBeenCalledWith('bill-1', 'acc-cash');
      expect(result).toEqual({ id: 'bill-1', status: 'PAID' });
    });
  });

  describe('void', () => {
    it('should call vendorBillsService.void with the id', async () => {
      service.void.mockResolvedValue({ id: 'bill-1', status: 'VOID' });

      const result = await controller.void('bill-1');

      expect(service.void).toHaveBeenCalledWith('bill-1');
      expect(result).toEqual({ id: 'bill-1', status: 'VOID' });
    });
  });
});
