import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceStatus,
  MpesaTransactionStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../prisma.service';
import { InvoicesService } from './invoices.service';
import { InitiateMpesaPaymentDto } from '../dto/initiate-mpesa-payment.dto';
import { ReconcileMpesaTransactionDto } from '../dto/reconcile-mpesa-transaction.dto';

type MpesaCallbackItem = {
  Name: string;
  Value?: string | number;
};

type MpesaStkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: {
    Item?: MpesaCallbackItem[];
  };
};

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly shortcode: string;
  private readonly passkey: string;
  private readonly callbackUrl: string;
  private readonly callbackToken: string;
  private readonly callbackIpAllowlist: string[];
  private readonly callbackSignatureSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invoicesService: InvoicesService,
  ) {
    const baseUrl =
      this.config.get<string>('MPESA_BASE_URL') ||
      'https://sandbox.safaricom.co.ke';

    this.consumerKey = this.config.get<string>('MPESA_CONSUMER_KEY') || '';
    this.consumerSecret =
      this.config.get<string>('MPESA_CONSUMER_SECRET') || '';
    this.shortcode = this.config.get<string>('MPESA_SHORTCODE') || '';
    this.passkey = this.config.get<string>('MPESA_PASSKEY') || '';
    this.callbackUrl = this.config.get<string>('MPESA_CALLBACK_URL') || '';
    this.callbackToken = this.config.get<string>('MPESA_CALLBACK_TOKEN') || '';
    this.callbackIpAllowlist = (
      this.config.get<string>('MPESA_CALLBACK_IP_ALLOWLIST') || ''
    )
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    this.callbackSignatureSecret =
      this.config.get<string>('MPESA_CALLBACK_SIGNATURE_SECRET') || '';

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async initiateStkPush(
    invoiceId: string,
    dto: InitiateMpesaPaymentDto,
    options?: { forceRetry?: boolean },
  ) {
    this.ensureConfigured();

    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new BadRequestException(
        'Only APPROVED invoices can initiate M-Pesa payment',
      );
    }

    const existingPending = await this.prisma.mpesaTransaction.findFirst({
      where: {
        invoiceId,
        status: MpesaTransactionStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending?.checkoutRequestId && !options?.forceRetry) {
      return {
        initiated: false,
        message: 'An M-Pesa request is already pending for this invoice',
        checkoutRequestId: existingPending.checkoutRequestId,
      };
    }

    if (existingPending?.id && options?.forceRetry) {
      await this.prisma.mpesaTransaction.update({
        where: { id: existingPending.id },
        data: {
          status: MpesaTransactionStatus.FAILED,
          resultDesc: 'Superseded by retry request from POS',
        },
      });
    }

    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const normalizedPhone = this.normalizePhoneNumber(dto.phoneNumber);
    const password = Buffer.from(
      `${this.shortcode}${this.passkey}${timestamp}`,
    ).toString('base64');

    const amount = Number(invoice.total);
    const accountReference =
      dto.accountReference || invoice.invoiceNo || invoice.customer.name;
    const transactionDesc =
      dto.description || `Payment for invoice ${invoice.invoiceNo}`;

    const callbackJoiner = this.callbackUrl.includes('?') ? '&' : '?';
    const callbackUrlWithToken = `${this.callbackUrl}${callbackJoiner}token=${this.callbackToken}`;

    let response;
    try {
      response = await this.axiosInstance.post(
        '/mpesa/stkpush/v1/processrequest',
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: normalizedPhone,
          PartyB: this.shortcode,
          PhoneNumber: normalizedPhone,
          CallBackURL: callbackUrlWithToken,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(this.extractAxiosErrorMessage(error));
    }

    const data = response.data as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
    };

    if (data.ResponseCode !== '0' || !data.CheckoutRequestID) {
      throw new BadRequestException(
        data.ResponseDescription || 'Failed to initiate M-Pesa STK push',
      );
    }

    const amountDecimal = new Prisma.Decimal(amount.toFixed(2));

    await this.prisma.mpesaTransaction.create({
      data: {
        invoiceId,
        phoneNumber: normalizedPhone,
        amount: amountDecimal,
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
        resultDesc: data.ResponseDescription,
        status: MpesaTransactionStatus.PENDING,
      },
    });

    return {
      initiated: true,
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage || data.ResponseDescription,
    };
  }

  async handleCallback(
    payload: unknown,
    providedToken?: string,
    requestIp?: string,
    providedSignature?: string,
  ) {
    this.ensureCallbackToken(providedToken);
    this.ensureCallbackIp(requestIp);
    this.ensureCallbackSignature(payload, providedSignature);

    const callback = this.extractCallback(payload);
    const checkoutRequestId = callback.CheckoutRequestID;

    if (!checkoutRequestId) {
      throw new BadRequestException('Callback missing CheckoutRequestID');
    }

    const transaction = await this.prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
      include: { invoice: true },
    });

    if (!transaction) {
      throw new NotFoundException('M-Pesa transaction not found');
    }

    const resultCode = Number(callback.ResultCode ?? -1);
    const resultDesc = callback.ResultDesc || 'No result description provided';
    const metadata = callback.CallbackMetadata?.Item || [];

    const amount = this.getMetaValue(metadata, 'Amount');
    const receiptNo = this.getMetaValue(metadata, 'MpesaReceiptNumber');
    const transactionDateRaw = this.getMetaValue(metadata, 'TransactionDate');
    const phone = this.getMetaValue(metadata, 'PhoneNumber');

    const isSuccess = resultCode === 0;

    await this.prisma.mpesaTransaction.update({
      where: { id: transaction.id },
      data: {
        resultCode,
        resultDesc,
        receiptNumber: receiptNo ? String(receiptNo) : null,
        transactionDate: transactionDateRaw
          ? this.parseMpesaDate(String(transactionDateRaw))
          : null,
        phoneNumber: phone ? String(phone) : transaction.phoneNumber,
        amount:
          typeof amount !== 'undefined'
            ? new Prisma.Decimal(Number(amount).toFixed(2))
            : transaction.amount,
        status: isSuccess
          ? MpesaTransactionStatus.SUCCESS
          : MpesaTransactionStatus.FAILED,
        callbackPayload: payload as Prisma.InputJsonValue,
      },
    });

    if (isSuccess && transaction.invoice.status !== InvoiceStatus.PAID) {
      await this.invoicesService.markAsPaid(
        transaction.invoiceId,
        PaymentMethod.MOBILE_MONEY,
      );
      this.logger.log(
        `Invoice ${transaction.invoiceId} marked as PAID from M-Pesa callback`,
      );
    }

    return { ok: true, checkoutRequestId, resultCode, resultDesc };
  }

  async getPendingTransactions(status?: MpesaTransactionStatus) {
    const statuses = status
      ? [status]
      : [MpesaTransactionStatus.PENDING, MpesaTransactionStatus.FAILED];

    const rows = await this.prisma.mpesaTransaction.findMany({
      where: { status: { in: statuses } },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            total: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((tx) => ({
      id: tx.id,
      status: tx.status,
      phoneNumber: tx.phoneNumber,
      amount: Number(tx.amount),
      checkoutRequestId: tx.checkoutRequestId,
      receiptNumber: tx.receiptNumber,
      resultCode: tx.resultCode,
      resultDesc: tx.resultDesc,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      invoice: {
        id: tx.invoice.id,
        invoiceNo: tx.invoice.invoiceNo,
        status: tx.invoice.status,
        total: Number(tx.invoice.total),
        customerName: tx.invoice.customer.name,
      },
    }));
  }

  async retryTransaction(transactionId: string) {
    const tx = await this.prisma.mpesaTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!tx) {
      throw new NotFoundException('M-Pesa transaction not found');
    }

    if (tx.invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (tx.invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Approve invoice before retrying payment');
    }

    return this.initiateStkPush(
      tx.invoiceId,
      {
        phoneNumber: tx.phoneNumber,
        accountReference: tx.invoice.invoiceNo,
        description: `Retry payment for ${tx.invoice.invoiceNo}`,
      },
      { forceRetry: true },
    );
  }

  async reconcileTransaction(
    transactionId: string,
    dto: ReconcileMpesaTransactionDto,
  ) {
    const tx = await this.prisma.mpesaTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!tx) {
      throw new NotFoundException('M-Pesa transaction not found');
    }

    const amount =
      typeof dto.amount === 'number' ? dto.amount : Number(tx.amount);

    await this.prisma.mpesaTransaction.update({
      where: { id: tx.id },
      data: {
        status: MpesaTransactionStatus.SUCCESS,
        resultCode: 0,
        resultDesc: dto.notes || 'Reconciled manually from POS panel',
        receiptNumber: dto.receiptNumber,
        phoneNumber: dto.phoneNumber || tx.phoneNumber,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        transactionDate: new Date(),
      },
    });

    if (tx.invoice.status !== InvoiceStatus.PAID) {
      await this.invoicesService.markAsPaid(
        tx.invoiceId,
        PaymentMethod.MOBILE_MONEY,
      );
    }

    return { reconciled: true, invoiceId: tx.invoiceId, transactionId: tx.id };
  }

  async getInvoicePaymentStatus(invoiceId: string) {
    const [invoice, transaction] = await Promise.all([
      this.prisma.salesInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNo: true,
          status: true,
          paymentMethod: true,
          paidAt: true,
        },
      }),
      this.prisma.mpesaTransaction.findFirst({
        where: { invoiceId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      invoice,
      mpesa: transaction
        ? {
            id: transaction.id,
            status: transaction.status,
            checkoutRequestId: transaction.checkoutRequestId,
            receiptNumber: transaction.receiptNumber,
            resultCode: transaction.resultCode,
            resultDesc: transaction.resultDesc,
            phoneNumber: transaction.phoneNumber,
            transactionDate: transaction.transactionDate,
            updatedAt: transaction.updatedAt,
          }
        : null,
    };
  }

  private ensureConfigured() {
    const hasPlaceholders = [
      this.consumerKey,
      this.consumerSecret,
      this.shortcode,
      this.passkey,
      this.callbackUrl,
      this.callbackToken,
    ].some((value) => value.includes('YOUR_') || value.includes('change_this'));

    if (
      !this.consumerKey ||
      !this.consumerSecret ||
      !this.shortcode ||
      !this.passkey ||
      !this.callbackUrl ||
      !this.callbackToken ||
      hasPlaceholders
    ) {
      throw new BadRequestException(
        'M-Pesa is not fully configured. Set real values for MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL and MPESA_CALLBACK_TOKEN.',
      );
    }

    if (!/^\d{5,7}$/.test(this.shortcode)) {
      throw new BadRequestException('MPESA_SHORTCODE must be numeric.');
    }
  }

  private ensureCallbackToken(providedToken?: string) {
    const expected = this.config.get<string>('MPESA_CALLBACK_TOKEN') || '';

    if (!expected) {
      throw new BadRequestException('MPESA_CALLBACK_TOKEN is not configured');
    }

    if (!providedToken || providedToken !== expected) {
      throw new UnauthorizedException('Invalid callback token');
    }
  }

  private ensureCallbackIp(requestIp?: string) {
    if (!this.callbackIpAllowlist.length) {
      return;
    }

    const ip = this.normalizeIp(requestIp);
    if (!ip || !this.callbackIpAllowlist.includes(ip)) {
      throw new UnauthorizedException('Callback IP is not allowed');
    }
  }

  private ensureCallbackSignature(
    payload: unknown,
    providedSignature?: string,
  ) {
    if (!this.callbackSignatureSecret) {
      return;
    }

    if (!providedSignature) {
      throw new UnauthorizedException('Missing callback signature');
    }

    const expected = createHmac('sha256', this.callbackSignatureSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (providedSignature !== expected) {
      throw new UnauthorizedException('Invalid callback signature');
    }
  }

  private normalizeIp(raw?: string): string | undefined {
    if (!raw) {
      return undefined;
    }

    const first = raw.split(',')[0]?.trim();
    if (!first) {
      return undefined;
    }

    if (first.startsWith('::ffff:')) {
      return first.slice(7);
    }

    return first;
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`,
    ).toString('base64');

    let response;
    try {
      response = await this.axiosInstance.get(
        '/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(this.extractAxiosErrorMessage(error));
    }

    const accessToken = response.data?.access_token as string | undefined;

    if (!accessToken) {
      throw new BadRequestException('Failed to obtain M-Pesa access token');
    }

    return accessToken;
  }

  private extractAxiosErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        errorMessage?: string;
        errorCode?: string;
        ResponseDescription?: string;
      }>;

      const data = axiosError.response?.data;
      const providerMessage =
        data?.errorMessage || data?.ResponseDescription || axiosError.message;
      const status = axiosError.response?.status;

      if (status) {
        return `M-Pesa request failed (${status}): ${providerMessage}`;
      }

      return `M-Pesa request failed: ${providerMessage}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'M-Pesa request failed';
  }

  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('254') && digits.length === 12) {
      return digits;
    }

    if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }

    throw new BadRequestException(
      'Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX.',
    );
  }

  private getTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  private extractCallback(payload: unknown): MpesaStkCallback {
    const body = payload as {
      Body?: {
        stkCallback?: MpesaStkCallback;
      };
    };

    const callback = body?.Body?.stkCallback;

    if (!callback) {
      throw new BadRequestException('Invalid M-Pesa callback payload');
    }

    return callback;
  }

  private getMetaValue(items: MpesaCallbackItem[], key: string) {
    return items.find((item) => item.Name === key)?.Value;
  }

  private parseMpesaDate(raw: string): Date {
    // M-Pesa sends yyyyMMddHHmmss (e.g. 20260407145530)
    if (!/^\d{14}$/.test(raw)) {
      return new Date();
    }

    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(8, 10));
    const minute = Number(raw.slice(10, 12));
    const second = Number(raw.slice(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }
}
