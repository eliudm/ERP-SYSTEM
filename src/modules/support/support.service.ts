import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  private async nextTicketNo(tenantId: string): Promise<string> {
    const count = await this.prisma.supportTicket.count({ where: { tenantId } });
    return `TKT-${String(count + 1).padStart(5, '0')}`;
  }

  async listTickets(page = 1, limit = 20, status?: string) {
    const tenantId = getCurrentTenantId()!;
    const where: any = { tenantId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          createdBy: { select: { firstName: true, lastName: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getTicket(id: string) {
    const tenantId = getCurrentTenantId()!;
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async createTicket(dto: { subject: string; category: string; priority?: string; message: string }, userId?: string) {
    const tenantId = getCurrentTenantId()!;
    const ticketNo = await this.nextTicketNo(tenantId);

    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        ticketNo,
        subject: dto.subject,
        category: dto.category as any,
        priority: (dto.priority ?? 'MEDIUM') as any,
        createdById: userId ?? null,
        messages: {
          create: {
            content: dto.message,
            isStaff: false,
            authorId: userId ?? null,
          },
        },
      },
      include: { messages: true },
    });
  }

  async addMessage(ticketId: string, content: string, userId?: string, isStaff = false) {
    const tenantId = getCurrentTenantId()!;
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === 'CLOSED') throw new BadRequestException('Ticket is closed');

    const msg = await this.prisma.ticketMessage.create({
      data: { ticketId, content, isStaff, authorId: userId ?? null },
    });

    // If customer replies, re-open if waiting
    const newStatus = isStaff ? 'WAITING' : ticket.status === 'WAITING' ? 'IN_PROGRESS' : ticket.status;
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: newStatus as any, updatedAt: new Date() },
    });

    return msg;
  }

  async updateStatus(ticketId: string, status: string) {
    const tenantId = getCurrentTenantId()!;
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status as any,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
      },
    });
  }

  async getStats() {
    const tenantId = getCurrentTenantId()!;
    const [open, inProgress, waiting, resolved] = await Promise.all([
      this.prisma.supportTicket.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { tenantId, status: 'WAITING' } }),
      this.prisma.supportTicket.count({ where: { tenantId, status: 'RESOLVED' } }),
    ]);
    return { open, inProgress, waiting, resolved };
  }
}
