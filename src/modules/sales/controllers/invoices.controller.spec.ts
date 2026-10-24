import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from '../services/invoices.service';
import { MpesaService } from '../services/mpesa.service';
import { PaymentMethod } from '@prisma/client';

const mockInvoicesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  getSalesSummary: jest.fn(),
  getMonthlySales: jest.fn(),
  getDailySummary: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  markAsPaid: jest.fn(),
  void: jest.fn(),
});

const mockMpesaService = () => ({
  getPendingTransactions: jest.fn(),
  retryTransaction: jest.fn(),
  reconcileTransaction: jest.fn(),
  initiateStkPush: jest.fn(),
  getInvoicePaymentStatus: jest.fn(),
});

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let invoicesService: ReturnType<typeof mockInvoicesService>;
  let mpesaService: ReturnType<typeof mockMpesaService>;

  beforeEach(async () => {
    invoicesService = mockInvoicesService();
    mpesaService = mockMpesaService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: invoicesService },
        { provide: MpesaService, useValue: mpesaService },
      ],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  describe('create', () => {
    it('should call invoicesService.create with the dto and user id', async () => {
      const dto = { customerId: 'cust-1', items: [] };
      const expected = { id: 'inv-1' };
      invoicesService.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any, { user: { id: 'user-1' } });

      expect(invoicesService.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should parse page and limit and call invoicesService.findAll', async () => {
      const expected = { data: [], meta: {} };
      invoicesService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('2', '10', 'PAID');

      expect(invoicesService.findAll).toHaveBeenCalledWith(2, 10, 'PAID');
      expect(result).toEqual(expected);
    });

    it('should default page and limit when not provided', async () => {
      invoicesService.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(undefined as any, undefined as any, undefined as any);

      expect(invoicesService.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('getSummary', () => {
    it('should call invoicesService.getSalesSummary with the date range', async () => {
      const expected = { totalRevenue: 100 };
      invoicesService.getSalesSummary.mockResolvedValue(expected);

      const result = await controller.getSummary('2026-01-01', '2026-01-31');

      expect(invoicesService.getSalesSummary).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getMonthly', () => {
    it('should call invoicesService.getMonthlySales with the parsed year', async () => {
      const expected = { year: 2026, months: [] };
      invoicesService.getMonthlySales.mockResolvedValue(expected);

      const result = await controller.getMonthly('2026');

      expect(invoicesService.getMonthlySales).toHaveBeenCalledWith(2026);
      expect(result).toEqual(expected);
    });
  });

  describe('getDailySummary', () => {
    it('should call invoicesService.getDailySummary with the given date', async () => {
      const expected = { date: '2026-04-02' };
      invoicesService.getDailySummary.mockResolvedValue(expected);

      const result = await controller.getDailySummary('2026-04-02');

      expect(invoicesService.getDailySummary).toHaveBeenCalledWith('2026-04-02');
      expect(result).toEqual(expected);
    });
  });

  describe('getPendingMpesaTransactions', () => {
    it('should call mpesaService.getPendingTransactions with the status', async () => {
      const expected = [{ id: 'txn-1' }];
      mpesaService.getPendingTransactions.mockResolvedValue(expected);

      const result = await controller.getPendingMpesaTransactions('PENDING' as any);

      expect(mpesaService.getPendingTransactions).toHaveBeenCalledWith('PENDING');
      expect(result).toEqual(expected);
    });
  });

  describe('retryMpesaTransaction', () => {
    it('should call mpesaService.retryTransaction with the transaction id', async () => {
      const expected = { id: 'txn-1', status: 'RETRYING' };
      mpesaService.retryTransaction.mockResolvedValue(expected);

      const result = await controller.retryMpesaTransaction('txn-1');

      expect(mpesaService.retryTransaction).toHaveBeenCalledWith('txn-1');
      expect(result).toEqual(expected);
    });
  });

  describe('reconcileMpesaTransaction', () => {
    it('should call mpesaService.reconcileTransaction with the id and dto', async () => {
      const dto = { status: 'COMPLETED' };
      const expected = { id: 'txn-1', ...dto };
      mpesaService.reconcileTransaction.mockResolvedValue(expected);

      const result = await controller.reconcileMpesaTransaction('txn-1', dto as any);

      expect(mpesaService.reconcileTransaction).toHaveBeenCalledWith('txn-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call invoicesService.findOne with the id', async () => {
      const expected = { id: 'inv-1' };
      invoicesService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('inv-1');

      expect(invoicesService.findOne).toHaveBeenCalledWith('inv-1');
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('should call invoicesService.approve with id, warehouseId, paymentMethod and user id', async () => {
      const expected = { id: 'inv-1', status: 'APPROVED' };
      invoicesService.approve.mockResolvedValue(expected);

      const result = await controller.approve(
        'inv-1',
        'wh-1',
        PaymentMethod.CASH,
        { user: { id: 'user-1' } },
      );

      expect(invoicesService.approve).toHaveBeenCalledWith(
        'inv-1',
        'wh-1',
        PaymentMethod.CASH,
        'user-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('markAsPaid', () => {
    it('should call invoicesService.markAsPaid with id, paymentMethod and user id', async () => {
      const expected = { id: 'inv-1', status: 'PAID' };
      invoicesService.markAsPaid.mockResolvedValue(expected);

      const result = await controller.markAsPaid('inv-1', PaymentMethod.CASH, {
        user: { id: 'user-1' },
      });

      expect(invoicesService.markAsPaid).toHaveBeenCalledWith(
        'inv-1',
        PaymentMethod.CASH,
        'user-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('initiateMpesaStkPush', () => {
    it('should call mpesaService.initiateStkPush with the id and dto', async () => {
      const dto = { phoneNumber: '0700000000', amount: 100 };
      const expected = { checkoutRequestId: 'chk-1' };
      mpesaService.initiateStkPush.mockResolvedValue(expected);

      const result = await controller.initiateMpesaStkPush('inv-1', dto as any);

      expect(mpesaService.initiateStkPush).toHaveBeenCalledWith('inv-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getMpesaStatus', () => {
    it('should call mpesaService.getInvoicePaymentStatus with the id', async () => {
      const expected = { status: 'PENDING' };
      mpesaService.getInvoicePaymentStatus.mockResolvedValue(expected);

      const result = await controller.getMpesaStatus('inv-1');

      expect(mpesaService.getInvoicePaymentStatus).toHaveBeenCalledWith('inv-1');
      expect(result).toEqual(expected);
    });
  });

  describe('void', () => {
    it('should call invoicesService.void with id, reason and user id', async () => {
      const expected = { id: 'inv-1', status: 'VOID' };
      invoicesService.void.mockResolvedValue(expected);

      const result = await controller.void('inv-1', 'cancelled', {
        user: { id: 'user-1' },
      });

      expect(invoicesService.void).toHaveBeenCalledWith(
        'inv-1',
        'cancelled',
        'user-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
