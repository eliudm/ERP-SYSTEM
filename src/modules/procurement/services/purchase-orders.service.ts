import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { StockMovementsService } from '../../inventory/services/stock-movements.service';
import { CreatePurchaseOrderDto, ReceiveGoodsDto } from '../dto';
import {
  ApprovalEntityType,
  PurchaseOrderStatus,
  MovementType,
} from '@prisma/client';
import { WorkflowService } from '../../workflow/workflow.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private stockMovements: StockMovementsService,
    private workflowService: WorkflowService,
  ) {}

  // ─── GENERATE ORDER NUMBER ───────────────────────────────
  private async generateOrderNo(): Promise<string> {
    const count = await this.prisma.purchaseOrder.count();
    const padded = String(count + 1).padStart(5, '0');
    return `PO-${padded}`;
  }

  // ─── CREATE PURCHASE ORDER (DRAFT) ───────────────────────
  async create(dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    let subtotal = 0;
    let taxAmount = 0;
    const itemsData: any[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      const lineTotal = item.quantity * item.unitCost;
      const lineTax = lineTotal * item.taxRate;

      subtotal += lineTotal;
      taxAmount += lineTax;

      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        taxAmount: lineTax,
        lineTotal: lineTotal + lineTax,
      });
    }

    const total = subtotal + taxAmount;
    const orderNo = await this.generateOrderNo();

    return this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        supplierId: dto.supplierId,
        orderDate: new Date(dto.orderDate),
        status: PurchaseOrderStatus.DRAFT,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        items: { create: itemsData },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });
  }

  // ─── APPROVE PURCHASE ORDER ──────────────────────────────
  async approve(id: string) {
    await this.workflowService.assertApprovalIfExists(
      ApprovalEntityType.PURCHASE_ORDER,
      id,
    );

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!po) throw new NotFoundException('Purchase order not found');

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `PO is already ${po.status}. Only DRAFT orders can be approved.`,
      );
    }

    // Get accounts payable account
    const apAccount = await this.prisma.account.findFirst({
      where: { code: '2000' },
    });
    const inventoryAccount = await this.prisma.account.findFirst({
      where: { code: '1200' },
    });
    const vatAccount = await this.prisma.account.findFirst({
      where: { code: '2100' },
    });

    if (!apAccount || !inventoryAccount || !vatAccount) {
      throw new BadRequestException(
        'Required accounts not found. Please seed chart of accounts first.',
      );
    }

    // Post accounting journal entry
    await this.postingEngine.postTransaction({
      reference: `PO-APPR-${po.orderNo}`,
      description: `Purchase Order ${po.orderNo} - ${po.supplier.name}`,
      entryDate: po.orderDate.toISOString(),
      sourceType: 'PURCHASE_ORDER',
      sourceId: po.id,
      lines: [
        // Debit Inventory
        {
          accountId: inventoryAccount.id,
          debit: Number(po.subtotal),
          credit: 0,
          description: `Inventory - ${po.orderNo}`,
        },
        // Debit VAT Input
        {
          accountId: vatAccount.id,
          debit: Number(po.taxAmount),
          credit: 0,
          description: `VAT Input - ${po.orderNo}`,
        },
        // Credit Accounts Payable
        {
          accountId: apAccount.id,
          debit: 0,
          credit: Number(po.total),
          description: `AP - ${po.orderNo}`,
        },
      ],
    });

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.APPROVED },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    await this.workflowService.consumeApprovedRequest(
      ApprovalEntityType.PURCHASE_ORDER,
      id,
    );

    return updated;
  }

  // ─── RECEIVE GOODS ───────────────────────────────────────
  async receiveGoods(id: string, dto: ReceiveGoodsDto) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    if (!po) throw new NotFoundException('Purchase order not found');

    if (po.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException(
        'Only APPROVED purchase orders can receive goods',
      );
    }

    // Create stock IN movements for each received item
    for (const receivedItem of dto.items) {
      // Validate item belongs to this PO
      const poItem = po.items.find(
        (item) => item.productId === receivedItem.productId,
      );

      if (!poItem) {
        throw new BadRequestException(
          `Product ${receivedItem.productId} is not in this purchase order`,
        );
      }

      // Create stock movement (IN)
      await this.stockMovements.create({
        productId: receivedItem.productId,
        warehouseId: receivedItem.warehouseId,
        movementType: MovementType.IN,
        quantity: receivedItem.quantityReceived,
        unitCost: Number(poItem.unitCost),
        reference: po.orderNo,
        notes: `Goods received from PO ${po.orderNo}`,
      });
    }

    // Mark PO as received
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.RECEIVED },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });
  }

  // ─── VOID PURCHASE ORDER ─────────────────────────────────
  async void(id: string, reason: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });

    if (!po) throw new NotFoundException('Purchase order not found');

    if (po.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException('Cannot void a received purchase order');
    }

    if (po.status === PurchaseOrderStatus.VOID) {
      throw new BadRequestException('Purchase order is already voided');
    }

    // Void related journal entry if approved
    if (po.status === PurchaseOrderStatus.APPROVED) {
      const journalEntry = await this.prisma.journalEntry.findFirst({
        where: { sourceType: 'PURCHASE_ORDER', sourceId: id },
      });

      if (journalEntry) {
        await this.postingEngine.voidTransaction(journalEntry.id, reason);
      }
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.VOID },
    });
  }

  // ─── CREATE VENDOR BILL FROM PO ──────────────────────────
  async createBillFromPO(id: string) {
    const po = await this.findOne(id);

    if (!['APPROVED', 'RECEIVED'].includes(po.status)) {
      throw new BadRequestException(
        'Only APPROVED or RECEIVED purchase orders can create a vendor bill',
      );
    }

    const billCount = await this.prisma.vendorBill.count();
    const billNumber = `BILL-${String(billCount + 1).padStart(5, '0')}`;

    const billItems = po.items.map((item: any) => {
      const lineSubtotal = Number(item.quantity) * Number(item.unitCost);
      const taxAmount = lineSubtotal * Number(item.taxRate);
      return {
        productId: item.productId,
        description: item.product?.name,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        taxRate: Number(item.taxRate),
        taxAmount,
        lineTotal: lineSubtotal + taxAmount,
      };
    });

    const subtotal = po.items.reduce(
      (s: number, i: any) => s + Number(i.quantity) * Number(i.unitCost),
      0,
    );
    const taxAmount = billItems.reduce((s, i) => s + i.taxAmount, 0);

    return this.prisma.vendorBill.create({
      data: {
        billNumber,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        billDate: new Date(),
        subtotal,
        taxAmount,
        total: subtotal + taxAmount,
        items: { create: billItems },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  // ─── GET ALL PURCHASE ORDERS ─────────────────────────────
  async findAll(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        skip,
        take: limit,
        where: status ? { status: status as any } : {},
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({
        where: status ? { status: status as any } : {},
      }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET ONE PURCHASE ORDER ──────────────────────────────
  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  // ─── PROCUREMENT SUMMARY ─────────────────────────────────
  async getSummary(startDate: string, endDate: string) {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        status: { not: PurchaseOrderStatus.VOID },
        orderDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, po) => sum + Number(po.total), 0);
    const totalReceived = orders
      .filter((po) => po.status === PurchaseOrderStatus.RECEIVED)
      .reduce((sum, po) => sum + Number(po.total), 0);

    return {
      period: { startDate, endDate },
      totalOrders,
      totalValue,
      totalReceived,
      pendingValue: totalValue - totalReceived,
    };
  }
}
