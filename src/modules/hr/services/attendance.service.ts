import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async clockIn(employeeId: string, notes?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Check if already clocked in
    const open = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId, clockOut: null },
    });
    if (open) throw new BadRequestException('Employee is already clocked in');

    return this.prisma.attendanceRecord.create({
      data: { employeeId, clockIn: new Date(), notes },
      include: { employee: true },
    });
  }

  async clockOut(employeeId: string, notes?: string) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!record)
      throw new BadRequestException('No open clock-in found for employee');

    const clockOut = new Date();
    const durationMins = Math.floor(
      (clockOut.getTime() - record.clockIn.getTime()) / 60000,
    );
    const type = durationMins > 480 ? 'OVERTIME' : 'REGULAR'; // > 8 hours = overtime

    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOut,
        durationMins,
        type: type as any,
        notes: notes || record.notes,
      },
      include: { employee: true },
    });
  }

  findAll(employeeId?: string, startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(startDate &&
          endDate && {
            clockIn: { gte: new Date(startDate), lte: new Date(endDate) },
          }),
      },
      include: { employee: true },
      orderBy: { clockIn: 'desc' },
    });
  }

  async getSummary(employeeId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        clockIn: { gte: start, lte: end },
        clockOut: { not: null },
      },
    });

    const totalMins = records.reduce((s, r) => s + (r.durationMins || 0), 0);
    const regularMins = records
      .filter((r) => r.type === 'REGULAR')
      .reduce((s, r) => s + (r.durationMins || 0), 0);
    const overtimeMins = records
      .filter((r) => r.type === 'OVERTIME')
      .reduce((s, r) => s + (r.durationMins || 0), 0);

    return {
      employeeId,
      month,
      year,
      totalDays: records.length,
      totalHours: (totalMins / 60).toFixed(2),
      regularHours: (regularMins / 60).toFixed(2),
      overtimeHours: (overtimeMins / 60).toFixed(2),
    };
  }

  async bulkImport(
    records: {
      employeeId: string;
      clockIn: string;
      clockOut: string;
      notes?: string;
    }[],
  ) {
    const created = await this.prisma.$transaction(
      records.map((r) => {
        const clockIn = new Date(r.clockIn);
        const clockOut = new Date(r.clockOut);
        const durationMins = Math.floor(
          (clockOut.getTime() - clockIn.getTime()) / 60000,
        );
        return this.prisma.attendanceRecord.create({
          data: {
            employeeId: r.employeeId,
            clockIn,
            clockOut,
            durationMins,
            type: durationMins > 480 ? 'OVERTIME' : 'REGULAR',
            notes: r.notes,
          },
        });
      }),
    );
    return { imported: created.length };
  }
}
