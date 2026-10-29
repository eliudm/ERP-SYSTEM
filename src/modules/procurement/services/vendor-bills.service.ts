import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { computeLineTax } from '../../../common/utils/tax.util';

export class VendorBillItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsNumber()
  @Min(0)
  taxRate!: number;

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean; // defaults to true
}

export class CreateVendorBillDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsDateString()
  billDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorBillItemInputDto)
  items!: VendorBillItemInputDto[];
}

export class PayVendorBillDto {
  @IsString()
  @IsNotEmpty()
  cashAccountId!: string;
}

// Real Accounts Payable, not this file's former mistaken use of code
// '2100' (which is actually seeded as VAT Payable).
const AP_ACCOUNT_CODE = '2000';

@Injectable()
export class VendorBillsService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
  ) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.vendorBill.count();
    return `BILL-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateVendorBillDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const items = dto.items.map((i) => {
      const isTaxInclusive = i.isTaxInclusive ?? true;
      const {
        taxAmount: tax,
        net,
        gross,
      } = computeLineTax(i.quantity * i.unitCost, i.taxRate, isTaxInclusive);
      return {
        ...i,
        taxAmount: tax,
        lineTotal: gross,
        lineSubtotal: net,
        isTaxInclusive,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.lineSubtotal, 0);
    const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;
    const billNumber = await this.generateNumber();

    return this.prisma.vendorBill.create({
      data: {
        tenantId: supplier.tenantId,
        billNumber,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        billDate: new Date(dto.billDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitCost: i.unitCost,
            taxRate: i.taxRate,
            taxAmount: i.taxAmount,
            lineTotal: i.lineTotal,
            isTaxInclusive: i.isTaxInclusive,
          })),
        },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  async findAll(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.vendorBill.findMany({
        where,
        skip,
        take: limit,
        include: { supplier: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorBill.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const bill = await this.prisma.vendorBill.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: true,
        items: { include: { product: true } },
      },
    });
    if (!bill) throw new NotFoundException('Vendor bill not found');
    return bill;
  }

  // ─── APPROVE: creates AP journal entry ──────────────────
  async approve(id: string) {
    const bill = await this.findOne(id);
    if (bill.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT bills can be approved');

    // Get AP and Expense accounts. Real Accounts Payable is code '2000' —
    // '2100' is seeded as VAT Payable, a different liability entirely.
    const apAccount = await this.prisma.account.findFirst({
      where: { code: AP_ACCOUNT_CODE },
    });
    const expenseAccount = await this.prisma.account.findFirst({
      where: { code: '5000' },
    });
    const taxAccount = await this.prisma.account.findFirst({
      where: { code: '1300' },
    });

    if (!apAccount || !expenseAccount || !taxAccount) {
      throw new BadRequestException(
        `Required GL accounts not configured (AP: ${AP_ACCOUNT_CODE}, Expense: 5000, Input Tax: 1300)`,
      );
    }

    await this.postingEngine.postTransaction({
      reference: `BILL-JE-${bill.billNumber}`,
      description: `Vendor Bill ${bill.billNumber} from ${bill.supplier.name}`,
      entryDate: bill.billDate.toISOString(),
      sourceType: 'VENDOR_BILL',
      sourceId: bill.id,
      lines: [
        {
          accountId: expenseAccount.id,
          debit: Number(bill.subtotal),
          credit: 0,
          description: 'Purchase expense',
        },
        {
          accountId: taxAccount.id,
          debit: Number(bill.taxAmount),
          credit: 0,
          description: 'Input VAT',
        },
        {
          accountId: apAccount.id,
          debit: 0,
          credit: Number(bill.total),
          description: 'Accounts payable',
        },
      ],
    });

    return this.prisma.vendorBill.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  // ─── PAY ────────────────────────────────────────────────
  // cashAccountId: the real cash/bank ASSET account the payment came from,
  // chosen by the caller — previously hardcoded to code '1100', which is
  // actually seeded as Accounts Receivable, not cash.
  async pay(id: string, cashAccountId: string) {
    const bill = await this.findOne(id);
    if (bill.status !== 'APPROVED')
      throw new BadRequestException('Only APPROVED bills can be paid');

    const [bankAccount, apAccount] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: cashAccountId } }),
      this.prisma.account.findFirst({ where: { code: AP_ACCOUNT_CODE } }),
    ]);

    if (!bankAccount)
      throw new NotFoundException('Cash/bank account not found');
    if (!apAccount) {
      throw new BadRequestException(
        `Required GL account not configured (AP: ${AP_ACCOUNT_CODE})`,
      );
    }

    await this.postingEngine.postTransaction({
      reference: `BILL-PAY-${bill.billNumber}`,
      description: `Payment for ${bill.billNumber}`,
      entryDate: new Date().toISOString(),
      sourceType: 'VENDOR_PAYMENT',
      sourceId: bill.id,
      lines: [
        {
          accountId: apAccount.id,
          debit: Number(bill.total),
          credit: 0,
          description: 'Clear AP',
        },
        {
          accountId: bankAccount.id,
          debit: 0,
          credit: Number(bill.total),
          description: 'Bank payment',
        },
      ],
    });

    return this.prisma.vendorBill.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async void(id: string) {
    const bill = await this.prisma.vendorBill.findUnique({ where: { id } });
    if (!bill) throw new NotFoundException('Vendor bill not found');
    if (bill.status === 'PAID')
      throw new BadRequestException('Paid bills cannot be voided');
    return this.prisma.vendorBill.update({
      where: { id },
      data: { status: 'VOID' },
    });
  }
}
