import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { Prisma } from '@prisma/client';

export interface SegmentFilters {
  hasOverdueBalance?: boolean;       // customers with unpaid credit invoices
  minOutstandingBalance?: number;    // minimum outstanding balance amount
  lastPurchaseDays?: number;         // purchased within last N days (active)
  noPurchaseDays?: number;           // no purchase in last N days (dormant)
  minTotalOrders?: number;           // minimum number of invoices ever
  creditOnly?: boolean;              // only credit-allowed customers
  isActive?: boolean;                // only active customers
}

@Injectable()
export class SegmentationService {
  constructor(private prisma: PrismaService) {}

  // ─── Build WHERE clause from filters ────────────────────────────────────
  private buildCustomerWhere(tenantId: string, filters: SegmentFilters): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { tenantId };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.creditOnly) {
      where.creditAllowed = true;
    }

    if (filters.minTotalOrders) {
      where.invoices = { some: {} };
    }

    if (filters.lastPurchaseDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.lastPurchaseDays);
      where.invoices = {
        ...(where.invoices as object),
        some: { invoiceDate: { gte: cutoff } },
      };
    }

    if (filters.noPurchaseDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.noPurchaseDays);
      where.invoices = {
        ...(where.invoices as object),
        none: { invoiceDate: { gte: cutoff } },
      };
    }

    if (filters.hasOverdueBalance) {
      where.invoices = {
        ...(where.invoices as object),
        some: { status: { in: ['APPROVED', 'SENT'] }, dueDate: { lt: new Date() } },
      };
    }

    return where;
  }

  // ─── Preview customers matching filters (no save) ───────────────────────
  async previewSegment(filters: SegmentFilters, page = 1, limit = 50) {
    const tenantId = getCurrentTenantId()!;
    const where = this.buildCustomerWhere(tenantId, filters);

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          creditAllowed: true,
          isActive: true,
          _count: { select: { invoices: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    // For each customer, compute outstanding balance if needed
    let results: any[] = customers;
    if (filters.hasOverdueBalance || filters.minOutstandingBalance) {
      const customerIds = customers.map((c) => c.id);

      // Sum unpaid invoice totals per customer (APPROVED/PARTIAL invoices)
      const invoiceTotals = await this.prisma.salesInvoice.groupBy({
        by: ['customerId'],
        where: {
          tenantId,
          customerId: { in: customerIds },
          status: { in: ['APPROVED', 'SENT'] },
        },
        _sum: { total: true },
      });

      // Sum credit payments per customer via their invoices
      const creditPayments = await this.prisma.creditPayment.findMany({
        where: {
          tenantId,
          invoice: { customerId: { in: customerIds } },
        },
        select: { amount: true, invoice: { select: { customerId: true } } },
      });

      const invoiceMap = new Map(
        invoiceTotals.map((r) => [r.customerId, Number(r._sum?.total ?? 0)]),
      );
      const paidMap = new Map<string, number>();
      for (const cp of creditPayments) {
        const cid = cp.invoice.customerId;
        paidMap.set(cid, (paidMap.get(cid) ?? 0) + Number(cp.amount));
      }

      results = customers.map((c) => ({
        ...c,
        outstandingBalance: (invoiceMap.get(c.id) ?? 0) - (paidMap.get(c.id) ?? 0),
      }));

      if (filters.minOutstandingBalance) {
        results = results.filter((c) => c.outstandingBalance >= filters.minOutstandingBalance!);
      }
      if (filters.hasOverdueBalance) {
        results = results.filter((c) => c.outstandingBalance > 0);
      }
    }

    return { data: results, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Resolve customer IDs for a saved segment ───────────────────────────
  async resolveCustomerIds(filters: SegmentFilters): Promise<{ id: string; phone: string | null; name: string }[]> {
    const tenantId = getCurrentTenantId()!;
    const where = this.buildCustomerWhere(tenantId, filters);
    return this.prisma.customer.findMany({
      where,
      select: { id: true, phone: true, name: true },
    });
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────
  async listSegments() {
    const tenantId = getCurrentTenantId()!;
    return this.prisma.customerSegment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSegment(dto: { name: string; description?: string; filters: SegmentFilters }) {
    const tenantId = getCurrentTenantId()!;
    const preview = await this.previewSegment(dto.filters);
    return this.prisma.customerSegment.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        filters: dto.filters as any,
        customerCount: preview.meta.total,
      },
    });
  }

  async updateSegment(id: string, dto: { name?: string; description?: string; filters?: SegmentFilters }) {
    const tenantId = getCurrentTenantId()!;
    const seg = await this.prisma.customerSegment.findFirst({ where: { id, tenantId } });
    if (!seg) throw new NotFoundException('Segment not found');

    const filters = dto.filters ?? (seg.filters as SegmentFilters);
    const preview = await this.previewSegment(filters);

    return this.prisma.customerSegment.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.filters ? { filters: dto.filters as any } : {}),
        customerCount: preview.meta.total,
      },
    });
  }

  async deleteSegment(id: string) {
    const tenantId = getCurrentTenantId()!;
    const seg = await this.prisma.customerSegment.findFirst({ where: { id, tenantId } });
    if (!seg) throw new NotFoundException('Segment not found');
    return this.prisma.customerSegment.delete({ where: { id } });
  }

  // ─── Campaign analytics ──────────────────────────────────────────────────
  async getCampaignAnalytics(campaignId: string) {
    const tenantId = getCurrentTenantId()!;

    const campaign = await this.prisma.smsCampaign.findFirst({
      where: { id: campaignId, tenantId },
      include: { _count: { select: { messages: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Delivery breakdown
    const statusGroups = await this.prisma.smsMessage.groupBy({
      by: ['status'],
      where: { campaignId, tenantId },
      _count: true,
    });
    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) byStatus[g.status] = g._count;

    // Revenue attribution: invoices paid within 30 days of campaign send
    // by customers who received this campaign
    let attributedRevenue = 0;
    let attributedInvoices = 0;

    if (campaign.sentAt) {
      const windowEnd = new Date(campaign.sentAt);
      windowEnd.setDate(windowEnd.getDate() + 30);

      const customerIds = await this.prisma.smsMessage.findMany({
        where: { campaignId, tenantId, customerId: { not: null } },
        select: { customerId: true },
        distinct: ['customerId'],
      });

      if (customerIds.length > 0) {
        const ids = customerIds.map((r) => r.customerId!);
        const invoices = await this.prisma.salesInvoice.aggregate({
          where: {
            tenantId,
            customerId: { in: ids },
            status: 'PAID',
            paidAt: { gte: campaign.sentAt, lte: windowEnd },
          },
          _sum: { total: true },
          _count: true,
        });
        attributedRevenue = Number(invoices._sum.total ?? 0);
        attributedInvoices = invoices._count;
      }
    }

    const totalSent = campaign.sentCount;
    const deliveredCount = byStatus['DELIVERED'] ?? 0;
    const failedCount = byStatus['FAILED'] ?? 0;
    const pendingCount = byStatus['PENDING'] ?? 0;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        recipientCount: campaign.recipientCount,
        sentCount: totalSent,
        failedCount: campaign.failedCount,
        sentAt: campaign.sentAt,
      },
      delivery: {
        sent: totalSent,
        delivered: deliveredCount,
        failed: failedCount,
        pending: pendingCount,
        deliveryRate: totalSent > 0 ? Math.round((deliveredCount / totalSent) * 100) : 0,
      },
      revenue: {
        attributedRevenue,
        attributedInvoices,
        attributionWindow: '30 days after send',
      },
    };
  }
}
