import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService) {}

  // ─── Job Postings ──────────────────────────────────────────────────────────

  createPosting(data: {
    title: string;
    department?: string;
    description?: string;
    requirements?: string;
    closingDate?: string;
  }) {
    return this.prisma.jobPosting.create({
      data: {
        ...data,
        closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
      },
    });
  }

  findAllPostings(status?: string) {
    return this.prisma.jobPosting.findMany({
      where: status ? { status: status as any } : undefined,
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePosting(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: { applications: { include: { interviews: true } } },
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }

  async updatePosting(
    id: string,
    data: Partial<{
      title: string;
      department: string;
      description: string;
      requirements: string;
      closingDate: string;
      status: string;
    }>,
  ) {
    await this.findOnePosting(id);
    return this.prisma.jobPosting.update({
      where: { id },
      data: {
        ...data,
        closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
        status: data.status as any,
      },
    });
  }

  async closePosting(id: string) {
    await this.findOnePosting(id);
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  // ─── Applications ───────────────────────────────────────────────────────────

  async createApplication(data: {
    jobPostingId: string;
    applicantName: string;
    applicantEmail: string;
    applicantPhone?: string;
    cvUrl?: string;
    coverLetter?: string;
  }) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { id: data.jobPostingId },
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    if (posting.status !== 'OPEN')
      throw new BadRequestException('Job posting is not open');

    return this.prisma.jobApplication.create({
      data: {
        jobPostingId: data.jobPostingId,
        applicantName: data.applicantName,
        email: data.applicantEmail,
        phone: data.applicantPhone,
        cvUrl: data.cvUrl,
        coverLetter: data.coverLetter,
      },
    });
  }

  findAllApplications(jobPostingId?: string, status?: string) {
    return this.prisma.jobApplication.findMany({
      where: {
        ...(jobPostingId && { jobPostingId }),
        ...(status && { status: status as any }),
      },
      include: { jobPosting: true, interviews: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneApplication(id: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: { jobPosting: true, interviews: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async updateApplicationStatus(id: string, status: string) {
    await this.findOneApplication(id);
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async shortlist(id: string) {
    return this.updateApplicationStatus(id, 'SHORTLISTED');
  }

  async reject(id: string) {
    return this.updateApplicationStatus(id, 'REJECTED');
  }

  async makeOffer(id: string) {
    return this.updateApplicationStatus(id, 'OFFERED');
  }

  // ─── Interviews ─────────────────────────────────────────────────────────────

  async scheduleInterview(data: {
    applicationId: string;
    scheduledAt: string;
    interviewerId: string;
    location?: string;
    notes?: string;
  }) {
    await this.findOneApplication(data.applicationId);
    await this.prisma.jobApplication.update({
      where: { id: data.applicationId },
      data: { status: 'INTERVIEWED' },
    });
    return this.prisma.interview.create({
      data: {
        jobApplicationId: data.applicationId,
        scheduledAt: new Date(data.scheduledAt),
        interviewerId: data.interviewerId,
        location: data.location,
        notes: data.notes,
      },
    });
  }

  recordInterviewResult(
    interviewId: string,
    result: string,
    feedback?: string,
  ) {
    return this.prisma.interview.update({
      where: { id: interviewId },
      data: { result: result as any, feedback },
    });
  }

  // ─── Hire Flow ──────────────────────────────────────────────────────────────

  async hire(
    applicationId: string,
    employeeData: {
      department: string;
      jobTitle: string;
      basicSalary: number;
      startDate?: string;
      nationalId?: string;
      phone?: string;
    },
  ) {
    const app = await this.findOneApplication(applicationId);
    if (app.status !== 'OFFERED')
      throw new BadRequestException(
        'Application must be in OFFERED status to hire',
      );

    const employee = await this.prisma.employee.create({
      data: {
        employeeNo: `EMP-${Date.now()}`,
        firstName: app.applicantName.split(' ')[0] || app.applicantName,
        lastName: app.applicantName.split(' ').slice(1).join(' ') || '-',
        email: app.email,
        phone: employeeData.phone || app.phone,
        department: employeeData.department,
        position: employeeData.jobTitle,
        salary: employeeData.basicSalary,
        startDate: employeeData.startDate
          ? new Date(employeeData.startDate)
          : new Date(),
      },
    });

    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'HIRED' },
    });
    await this.prisma.jobPosting.update({
      where: { id: app.jobPostingId },
      data: { status: 'CLOSED' },
    });

    return employee;
  }
}
