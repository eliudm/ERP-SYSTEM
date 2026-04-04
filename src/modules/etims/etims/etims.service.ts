import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma.service';
import { EtimsStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import * as QRCode from 'qrcode';
import { EtimsPayload } from '../dto/etims-payload.dto';

@Injectable()
export class EtimsService {
  private readonly logger = new Logger(EtimsService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly sellerPin: string;
  private readonly baseUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const isSandbox = config.get('ETIMS_ENV') === 'sandbox';
    const sandboxUrl = config.get<string>('ETIMS_SANDBOX_URL');
    const productionUrl = config.get<string>('ETIMS_BASE_URL');

    this.baseUrl = isSandbox ? sandboxUrl || '' : productionUrl || '';

    this.sellerPin = config.get<string>('ETIMS_SELLER_PIN') || '';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        tin: this.sellerPin,
        bhfId: '00',
        cmcKey: config.get('ETIMS_DEVICE_SERIAL'),
      },
    });
  }

  // ─── BUILD ETIMS PAYLOAD FROM INVOICE ────────────────────
  private async buildPayload(invoiceId: string): Promise<EtimsPayload> {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const itemList = invoice.items.map((item, index) => {
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      const taxAmt = Number(item.taxAmount);

      return {
        itemSeq: index + 1,
        itemCd: item.product.code,
        itemClsCd: '5020230602', // Default KRA item class code
        itemNm: item.product.name,
        qty: Number(item.quantity),
        prc: Number(item.unitPrice),
        splyAmt: lineTotal,
        dcRt: 0,
        dcAmt: 0,
        taxblAmt: lineTotal,
        taxTyCd: 'B', // VAT type B = 16%
        taxAmt,
        totAmt: lineTotal + taxAmt,
      };
    });

    const totTaxblAmt = Number(invoice.subtotal);
    const totTaxAmt = Number(invoice.taxAmount);
    const totAmt = Number(invoice.total);

    return {
      invcNo: invoice.invoiceNo,
      cfmDt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      pmtTyCd: 'CASH',
      rcptTyCd: 'S', // Sales receipt
      salesTyCd: 'N', // Normal sale
      custTpin: invoice.customer.taxPin || undefined,
      custNm: invoice.customer.name,
      salesSttsCd: '02', // Approved
      totItemCnt: invoice.items.length,
      taxblAmtA: 0,
      taxblAmtB: totTaxblAmt,
      taxblAmtC: 0,
      taxblAmtD: 0,
      taxRtA: 0,
      taxRtB: 16,
      taxRtC: 0,
      taxRtD: 0,
      taxAmtA: 0,
      taxAmtB: totTaxAmt,
      taxAmtC: 0,
      taxAmtD: 0,
      totTaxblAmt,
      totTaxAmt,
      totAmt,
      itemList,
    };
  }

  // ─── GENERATE QR CODE ────────────────────────────────────
  private async generateQRCode(data: string): Promise<string> {
    return QRCode.toDataURL(data);
  }

  private async buildProvisionalQRCode(
    invoiceId: string,
    invoiceNo: string,
    total: number,
    customerName: string,
    status: string,
  ): Promise<string> {
    return this.generateQRCode(
      JSON.stringify({
        type: 'PROVISIONAL_RECEIPT_QR',
        invoiceId,
        invoiceNo,
        sellerPin: this.sellerPin || 'UNCONFIGURED',
        customerName,
        total,
        status,
        generatedAt: new Date().toISOString(),
      }),
    );
  }

  // ─── SUBMIT TO ETIMS ─────────────────────────────────────
  async submitInvoice(invoiceId: string): Promise<void> {
    this.logger.log(`Submitting invoice ${invoiceId} to eTIMS`);

    // Find or create eTIMS record
    let etimsInvoice = await this.prisma.etimsInvoice.findUnique({
      where: { invoiceId },
    });

    if (!etimsInvoice) {
      etimsInvoice = await this.prisma.etimsInvoice.create({
        data: {
          invoiceId,
          status: EtimsStatus.PENDING,
        },
      });
    }

    if (etimsInvoice.status === EtimsStatus.SUCCESS) {
      this.logger.log(`Invoice ${invoiceId} already submitted successfully`);
      return;
    }

    // Build payload
    const payload = await this.buildPayload(invoiceId);

    // Log the attempt
    const log = await this.prisma.etimsSubmissionLog.create({
      data: {
        etimsId: etimsInvoice.id,
        attempt: etimsInvoice.retryCount + 1,
        requestData: payload as any,
        status: 'ATTEMPTING',
      },
    });

    try {
      // Submit to KRA eTIMS API
      const response = await this.axiosInstance.post('/trnsSalesOsdc', {
        tpin: this.sellerPin,
        bhfId: '00',
        ...payload,
      });

      const responseData = response.data;
      this.logger.log(`eTIMS response: ${JSON.stringify(responseData)}`);

      // Check KRA response code
      if (responseData.resultCd === '000') {
        // SUCCESS
        const qrData = `${payload.invcNo}|${this.sellerPin}|${responseData.data?.rcptNo || ''}`;
        const qrCode = await this.generateQRCode(qrData);

        // Update eTIMS record
        await this.prisma.etimsInvoice.update({
          where: { id: etimsInvoice.id },
          data: {
            status: EtimsStatus.SUCCESS,
            qrCode,
            etimsInvoiceNo: responseData.data?.rcptNo || payload.invcNo,
            submittedAt: new Date(),
            responseData: responseData,
            retryCount: { increment: 1 },
          },
        });

        // Update log
        await this.prisma.etimsSubmissionLog.update({
          where: { id: log.id },
          data: {
            status: 'SUCCESS',
            responseData: responseData,
          },
        });

        this.logger.log(
          `✅ Invoice ${invoiceId} submitted to eTIMS successfully`,
        );
      } else {
        // KRA returned an error code
        throw new Error(
          `eTIMS error: ${responseData.resultCd} - ${responseData.resultMsg}`,
        );
      }
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      this.logger.error(
        `❌ eTIMS submission failed for invoice ${invoiceId}: ${errorMessage}`,
      );

      // Update eTIMS record as failed
      await this.prisma.etimsInvoice.update({
        where: { id: etimsInvoice.id },
        data: {
          status: EtimsStatus.FAILED,
          retryCount: { increment: 1 },
        },
      });

      // Update log
      await this.prisma.etimsSubmissionLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage,
          responseData: error.response?.data || null,
        },
      });

      // Re-throw so queue can handle retry
      throw error;
    }
  }

  // ─── GET ETIMS STATUS ────────────────────────────────────
  async getStatus(invoiceId: string) {
    const etimsInvoice = await this.prisma.etimsInvoice.findUnique({
      where: { invoiceId },
      include: {
        submissionLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!etimsInvoice) {
      return { status: 'NOT_SUBMITTED', invoiceId };
    }

    return etimsInvoice;
  }

  // ─── GET QR CODE ─────────────────────────────────────────
  async getQRCode(invoiceId: string) {
    const etimsInvoice = await this.prisma.etimsInvoice.findUnique({
      where: { invoiceId },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
        submissionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (etimsInvoice?.qrCode) {
      return {
        invoiceId,
        qrCode: etimsInvoice.qrCode,
        etimsInvoiceNo: etimsInvoice.etimsInvoiceNo,
        provisional: false,
        status: etimsInvoice.status,
      };
    }

    const invoice =
      etimsInvoice?.invoice ||
      (await this.prisma.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
        },
      }));

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const status = etimsInvoice?.status || 'NOT_SUBMITTED';
    const latestError = etimsInvoice?.submissionLogs?.[0]?.errorMessage;
    const qrCode = await this.buildProvisionalQRCode(
      invoice.id,
      invoice.invoiceNo,
      Number(invoice.total),
      invoice.customer?.name || 'Walk-in Customer',
      status,
    );

    return {
      invoiceId,
      qrCode,
      etimsInvoiceNo: etimsInvoice?.etimsInvoiceNo,
      provisional: true,
      status,
      message:
        latestError ||
        'eTIMS QR not available yet. Showing provisional receipt QR.',
    };
  }

  // ─── MANUAL RETRY ────────────────────────────────────────
  async retrySubmission(invoiceId: string) {
    const etimsInvoice = await this.prisma.etimsInvoice.findUnique({
      where: { invoiceId },
    });

    if (!etimsInvoice) {
      throw new NotFoundException('eTIMS record not found for this invoice');
    }

    if (etimsInvoice.status === EtimsStatus.SUCCESS) {
      throw new BadRequestException('Invoice already successfully submitted');
    }

    if (etimsInvoice.retryCount >= 10) {
      throw new BadRequestException(
        'Maximum retry attempts (10) reached. Please contact support.',
      );
    }

    // Reset status to pending for retry
    await this.prisma.etimsInvoice.update({
      where: { invoiceId },
      data: { status: EtimsStatus.PENDING },
    });

    // Submit again
    await this.submitInvoice(invoiceId);

    return { message: 'Retry submitted successfully' };
  }

  // ─── GET FAILED SUBMISSIONS ──────────────────────────────
  async getFailedSubmissions() {
    return this.prisma.etimsInvoice.findMany({
      where: { status: EtimsStatus.FAILED },
      include: {
        invoice: { include: { customer: true } },
        submissionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ─── GET SUBMISSION STATS ────────────────────────────────
  async getStats() {
    const [total, success, failed, pending] = await Promise.all([
      this.prisma.etimsInvoice.count(),
      this.prisma.etimsInvoice.count({
        where: { status: EtimsStatus.SUCCESS },
      }),
      this.prisma.etimsInvoice.count({ where: { status: EtimsStatus.FAILED } }),
      this.prisma.etimsInvoice.count({
        where: { status: EtimsStatus.PENDING },
      }),
    ]);

    return {
      total,
      success,
      failed,
      pending,
      successRate:
        total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}
