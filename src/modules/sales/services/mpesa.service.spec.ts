import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { PrismaService } from '../../../prisma.service';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

const mockConfig = (overrides: Record<string, string> = {}) => ({
  get: jest.fn((key: string) => overrides[key]),
});

const mockPrisma = () => ({
  mpesaTillPayment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  salesInvoice: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('MpesaService — Till Number (C2B)', () => {
  let service: MpesaService;
  let prisma: ReturnType<typeof mockPrisma>;
  let invoicesService: { markAsPaid: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    invoicesService = { markAsPaid: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig() },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get<MpesaService>(MpesaService);
  });

  describe('handleC2BConfirmation', () => {
    const payload = {
      TransactionType: 'Pay Bill',
      TransID: 'NLJ7RT61SV',
      TransTime: '20260407145530',
      TransAmount: '500',
      BusinessShortCode: '600000',
      BillRefNumber: 'INV-001',
      MSISDN: '254712345678',
      FirstName: 'Jane',
      LastName: 'Doe',
    };

    it('should record a new unmatched till payment and always return success', async () => {
      prisma.mpesaTillPayment.findUnique.mockResolvedValue(null);

      const result = await service.handleC2BConfirmation(payload);

      expect(prisma.mpesaTillPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transId: 'NLJ7RT61SV',
            msisdn: '254712345678',
            firstName: 'Jane',
            lastName: 'Doe',
          }),
        }),
      );
      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });

    it('should not create a duplicate row for a TransID already recorded', async () => {
      prisma.mpesaTillPayment.findUnique.mockResolvedValue({
        id: 'existing-1',
        transId: 'NLJ7RT61SV',
      });

      const result = await service.handleC2BConfirmation(payload);

      expect(prisma.mpesaTillPayment.create).not.toHaveBeenCalled();
      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });

    it('should still return success even if recording the payment throws', async () => {
      prisma.mpesaTillPayment.findUnique.mockRejectedValue(
        new Error('db down'),
      );

      const result = await service.handleC2BConfirmation(payload);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });
  });

  describe('matchTillPayment', () => {
    const invoice = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      status: InvoiceStatus.APPROVED,
    };

    it('should match the payment, mark the invoice paid, and return it', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue(invoice);
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          mpesaTillPayment: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'till-1', isMatched: true }),
          },
        }),
      );

      const result = await service.matchTillPayment(
        'till-1',
        'inv-1',
        'user-1',
      );

      expect(invoicesService.markAsPaid).toHaveBeenCalledWith(
        'inv-1',
        PaymentMethod.MOBILE_MONEY,
      );
      expect(result).toEqual(
        expect.objectContaining({ matched: true, invoiceId: 'inv-1' }),
      );
    });

    it('should throw ConflictException if the payment was already matched (race condition)', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue(invoice);
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          mpesaTillPayment: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findUnique: jest.fn(),
          },
        }),
      );

      await expect(
        service.matchTillPayment('till-1', 'inv-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(invoicesService.markAsPaid).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the invoice is not APPROVED', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        ...invoice,
        status: InvoiceStatus.PAID,
      });

      await expect(
        service.matchTillPayment('till-1', 'inv-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('unmatchTillPayment', () => {
    it('should clear the match fields on a matched payment', async () => {
      prisma.mpesaTillPayment.findUnique.mockResolvedValue({
        id: 'till-1',
        isMatched: true,
      });
      prisma.mpesaTillPayment.update.mockResolvedValue({
        id: 'till-1',
        isMatched: false,
      });

      const result = await service.unmatchTillPayment('till-1');

      expect(prisma.mpesaTillPayment.update).toHaveBeenCalledWith({
        where: { id: 'till-1' },
        data: {
          isMatched: false,
          matchedInvoiceId: null,
          matchedAt: null,
          matchedByUserId: null,
        },
      });
      expect(result.isMatched).toBe(false);
    });

    it('should throw BadRequestException if the payment is not currently matched', async () => {
      prisma.mpesaTillPayment.findUnique.mockResolvedValue({
        id: 'till-1',
        isMatched: false,
      });

      await expect(service.unmatchTillPayment('till-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUnmatchedTillPayments', () => {
    it('should map rows to a flat shape with a derived payerName', async () => {
      prisma.mpesaTillPayment.findMany.mockResolvedValue([
        {
          id: 'till-1',
          transId: 'ABC',
          transTime: new Date('2026-04-07T14:55:30Z'),
          transAmount: 500,
          msisdn: '254712345678',
          firstName: 'Jane',
          middleName: null,
          lastName: 'Doe',
          billRefNumber: null,
        },
      ]);

      const result = await service.getUnmatchedTillPayments(60);

      expect(prisma.mpesaTillPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isMatched: false }),
        }),
      );
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'till-1',
          payerName: 'Jane Doe',
          amount: 500,
        }),
      );
    });
  });
});
