import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { OpenPosSessionDto } from '../dto/open-pos-session.dto';
import { ClosePosSessionDto } from '../dto/close-pos-session.dto';

@Injectable()
export class PosSessionsService {
  constructor(private prisma: PrismaService) {}

  private async generateSessionRef(branchId?: string | null): Promise<string> {
    let prefix = 'POS';
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });
      if (branch) prefix = branch.code;
    }
    const count = await this.prisma.posSession.count({ where: { branchId } });
    return `${prefix}/${String(count + 1).padStart(5, '0')}`;
  }

  // Idempotent: a cashier re-verifying (e.g. a second PIN prompt) should
  // reuse their already-open session, not fork a second one.
  async openSession(cashierId: string, dto: OpenPosSessionDto) {
    const existing = await this.prisma.posSession.findFirst({
      where: { cashierId, status: 'OPEN' },
    });
    if (existing) {
      // Block new-day sales if the previous session was never closed
      const sessionDay = new Date(existing.openedAt).toDateString();
      const today = new Date().toDateString();
      if (sessionDay !== today) {
        const dateLabel = new Date(existing.openedAt).toLocaleDateString('en-KE', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        throw new BadRequestException(
          `You have an unclosed register session from ${dateLabel}. Please close it before starting a new day.`,
        );
      }
      return existing;
    }

    const cashier = await this.prisma.user.findUnique({
      where: { id: cashierId },
    });
    if (!cashier) throw new NotFoundException('User not found');

    // Prefer an explicitly-chosen branch, else the cashier's own assigned
    // outlet (Settings > Users) — this is what makes "Point of Sale" on the
    // Orders list reliable instead of depending on whichever warehouse a
    // sale eventually gets fulfilled from.
    const branchId = dto.branchId ?? cashier.branchId ?? null;

    const sessionRef = await this.generateSessionRef(branchId);

    return this.prisma.posSession.create({
      data: {
        tenantId: cashier.tenantId,
        sessionRef,
        cashierId,
        branchId,
        status: 'OPEN',
      },
    });
  }

  async closeSession(id: string, dto: ClosePosSessionDto) {
    const session = await this.prisma.posSession.findUnique({
      where: { id },
    });
    if (!session) throw new BadRequestException('Session not found');
    if (session.status === 'CLOSED') {
      throw new BadRequestException('Session is already closed');
    }

    return this.prisma.posSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingNote: dto.closingNote,
        closingCounts: dto.closingCounts ?? undefined,
      },
    });
  }

  async getCurrentSession(cashierId: string) {
    return this.prisma.posSession.findFirst({
      where: { cashierId, status: 'OPEN' },
    });
  }

  async getSessionSummary(sessionId: string) {
    const session = await this.prisma.posSession.findUnique({
      where: { id: sessionId },
      include: {
        invoices: {
          where: { status: { in: ['APPROVED', 'PAID'] } },
          select: { total: true, paymentMethod: true },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const totalOrders = session.invoices.length;
    const totalRevenue = session.invoices.reduce(
      (sum, inv) => sum + Number(inv.total), 0,
    );

    const methodMap = new Map<string, { amount: number; orders: number }>();
    for (const inv of session.invoices) {
      const method = inv.paymentMethod ?? 'UNKNOWN';
      const existing = methodMap.get(method) ?? { amount: 0, orders: 0 };
      existing.amount += Number(inv.total);
      existing.orders += 1;
      methodMap.set(method, existing);
    }

    return {
      sessionId,
      sessionRef: session.sessionRef,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      totalOrders,
      totalRevenue,
      byPaymentMethod: Array.from(methodMap.entries()).map(([method, v]) => ({
        method, amount: v.amount, orders: v.orders,
      })),
    };
  }
}
