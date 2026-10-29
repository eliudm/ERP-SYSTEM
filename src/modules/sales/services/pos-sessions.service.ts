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
    if (existing) return existing;

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
}
