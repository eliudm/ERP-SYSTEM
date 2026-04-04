import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateLeaveDto } from '../dto';
import { LeaveStatus } from '@prisma/client';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  // ─── CALCULATE WORKING DAYS ──────────────────────────────
  private calculateWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++; // Skip weekends
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  // ─── APPLY FOR LEAVE ─────────────────────────────────────
  async create(dto: CreateLeaveDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping leave requests
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
      },
    });

    if (overlap) {
      throw new BadRequestException(
        'Employee already has a leave request overlapping these dates',
      );
    }

    const days = this.calculateWorkingDays(start, end);

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startDate: start,
        endDate: end,
        days,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
      include: { employee: true },
    });
  }

  // ─── APPROVE LEAVE ───────────────────────────────────────
  async approve(id: string, approverId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedBy: approverId,
      },
      include: { employee: true },
    });
  }

  // ─── REJECT LEAVE ────────────────────────────────────────
  async reject(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED },
      include: { employee: true },
    });
  }

  // ─── GET ALL LEAVE REQUESTS ──────────────────────────────
  async findAll(status?: string, employeeId?: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...(status && { status: status as LeaveStatus }),
        ...(employeeId && { employeeId }),
      },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── GET EMPLOYEE LEAVE BALANCE ──────────────────────────
  async getLeaveBalance(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { gte: startOfYear, lte: endOfYear },
      },
    });

    // Standard leave entitlements (Kenya Labour Law)
    const entitlements = {
      ANNUAL: 21, // 21 days annual leave
      SICK: 30, // 30 days sick leave
      MATERNITY: 90, // 90 days maternity
      PATERNITY: 14, // 14 days paternity
      UNPAID: 0,
    };

    const used: Record<string, number> = {
      ANNUAL: 0,
      SICK: 0,
      MATERNITY: 0,
      PATERNITY: 0,
      UNPAID: 0,
    };

    for (const leave of approvedLeaves) {
      used[leave.leaveType] += leave.days;
    }

    const balance = Object.entries(entitlements).map(([type, entitled]) => ({
      leaveType: type,
      entitled,
      used: used[type] || 0,
      remaining: Math.max(0, entitled - (used[type] || 0)),
    }));

    return { employee, year: currentYear, balance };
  }
}
