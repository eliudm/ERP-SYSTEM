import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  // ─── GENERATE EMPLOYEE NUMBER ────────────────────────────
  private async generateEmployeeNo(): Promise<string> {
    const count = await this.prisma.employee.count();
    const padded = String(count + 1).padStart(4, '0');
    return `EMP-${padded}`;
  }

  // ─── CREATE EMPLOYEE ─────────────────────────────────────
  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Employee with this email already exists');
    }

    const employeeNo = await this.generateEmployeeNo();

    return this.prisma.employee.create({
      data: {
        ...dto,
        employeeNo,
        startDate: new Date(dto.startDate),
      },
    });
  }

  // ─── GET ALL EMPLOYEES ───────────────────────────────────
  async findAll(search?: string, department?: string) {
    return this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        ...(department && { department }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { employeeNo: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { firstName: 'asc' },
    });
  }

  // ─── GET ONE EMPLOYEE ────────────────────────────────────
  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        payrollLines: {
          include: { payroll: true },
          orderBy: { createdAt: 'desc' as const },
          take: 12,
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' as const },
          take: 10,
        },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  // ─── UPDATE EMPLOYEE ─────────────────────────────────────
  async update(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: dto,
    });
  }

  // ─── TERMINATE EMPLOYEE ──────────────────────────────────
  async terminate(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED' },
    });
  }

  // ─── GET DEPARTMENTS ─────────────────────────────────────
  async getDepartments() {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', department: { not: null } },
      select: { department: true },
      distinct: ['department'],
    });

    return employees.map((e) => e.department).filter(Boolean);
  }

  // ─── HEADCOUNT SUMMARY ───────────────────────────────────
  async getHeadcount() {
    const [active, inactive, terminated] = await Promise.all([
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { status: 'INACTIVE' } }),
      this.prisma.employee.count({ where: { status: 'TERMINATED' } }),
    ]);

    // Group by department
    const byDepartment = await this.prisma.employee.groupBy({
      by: ['department'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });

    return {
      total: active + inactive + terminated,
      active,
      inactive,
      terminated,
      byDepartment: byDepartment.map((d) => ({
        department: d.department || 'Unassigned',
        count: d._count.id,
      })),
    };
  }
}
