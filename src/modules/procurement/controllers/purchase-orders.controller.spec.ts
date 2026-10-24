import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from '../services/purchase-orders.service';

const mockPoService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  receiveGoods: jest.fn(),
  createBillFromPO: jest.fn(),
  void: jest.fn(),
});

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  let service: ReturnType<typeof mockPoService>;

  beforeEach(async () => {
    service = mockPoService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [{ provide: PurchaseOrdersService, useValue: service }],
    }).compile();

    controller = module.get<PurchaseOrdersController>(
      PurchaseOrdersController,
    );
  });

  describe('create', () => {
    it('should call service.create with the dto and return its result', async () => {
      const dto = { supplierId: 'sup-1', orderDate: '2024-01-01', items: [] };
      const expected = { id: 'po-1' };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('findAll', () => {
    it('should parse page and limit and call service.findAll', async () => {
      const expected = { data: [], meta: {} };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('2', '10', 'DRAFT');

      expect(service.findAll).toHaveBeenCalledWith(2, 10, 'DRAFT');
      expect(result).toBe(expected);
    });

    it('should default page to 1 and limit to 20 when not parseable', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll('', '', undefined as any);

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('getSummary', () => {
    it('should call service.getSummary with the date range', async () => {
      const expected = { totalOrders: 1 };
      service.getSummary.mockResolvedValue(expected);

      const result = await controller.getSummary('2024-01-01', '2024-01-31');

      expect(service.getSummary).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toBe(expected);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the id', async () => {
      const expected = { id: 'po-1' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('po-1');

      expect(service.findOne).toHaveBeenCalledWith('po-1');
      expect(result).toBe(expected);
    });
  });

  describe('approve', () => {
    it('should call service.approve with the id', async () => {
      const expected = { id: 'po-1', status: 'APPROVED' };
      service.approve.mockResolvedValue(expected);

      const result = await controller.approve('po-1');

      expect(service.approve).toHaveBeenCalledWith('po-1');
      expect(result).toBe(expected);
    });
  });

  describe('receiveGoods', () => {
    it('should call service.receiveGoods with the id and dto', async () => {
      const dto = { items: [] };
      const expected = { id: 'po-1', status: 'RECEIVED' };
      service.receiveGoods.mockResolvedValue(expected);

      const result = await controller.receiveGoods('po-1', dto as any);

      expect(service.receiveGoods).toHaveBeenCalledWith('po-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('createBill', () => {
    it('should call service.createBillFromPO with the id', async () => {
      const expected = { id: 'bill-1' };
      service.createBillFromPO.mockResolvedValue(expected);

      const result = await controller.createBill('po-1');

      expect(service.createBillFromPO).toHaveBeenCalledWith('po-1');
      expect(result).toBe(expected);
    });
  });

  describe('void', () => {
    it('should call service.void with the id and reason', async () => {
      const expected = { id: 'po-1', status: 'VOID' };
      service.void.mockResolvedValue(expected);

      const result = await controller.void('po-1', 'mistake');

      expect(service.void).toHaveBeenCalledWith('po-1', 'mistake');
      expect(result).toBe(expected);
    });
  });
});
