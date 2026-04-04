import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';

export class CreateVendorBillDto {
  supplierId: string;
  purchaseOrderId?: string;
  billDate: string;
  dueDate?: string;
  notes?: string;
  items: {
    productId: string;
    description?: string;
    quantity: number;
    unitCost: number;
    taxRate: number;
  }[];
}

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
      const lineSubtotal = i.quantity * i.unitCost;
      const taxAmount = lineSubtotal * i.taxRate;
      return { ...i, taxAmount, lineTotal: lineSubtotal + taxAmount };
    });

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;
    const billNumber = await this.generateNumber();

    return this.prisma.vendorBill.create({
      data: {
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

    // Get AP and Expense accounts
    const apAccount = await this.prisma.account.findFirst({
      where: { code: '2100' },
    });
    const expenseAccount = await this.prisma.account.findFirst({
      where: { code: '5000' },
    });
    const taxAccount = await this.prisma.account.findFirst({
      where: { code: '1300' },
    });

    if (!apAccount || !expenseAccount || !taxAccount) {
      throw new BadRequestException(
        'Required GL accounts not configured (AP: 2100, Expense: 5000, Input Tax: 1300)',
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
  async pay(id: string) {
    const bill = await this.findOne(id);
    if (bill.status !== 'APPROVED')
      throw new BadRequestException('Only APPROVED bills can be paid');

    // Get bank/cash and AP accounts
    const bankAccount = await this.prisma.account.findFirst({
      where: { code: '1100' },
    });
    const apAccount = await this.prisma.account.findFirst({
      where: { code: '2100' },
    });

    if (!bankAccount || !apAccount) {
      throw new BadRequestException(
        'Required GL accounts not configured (Bank: 1100, AP: 2100)',
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
