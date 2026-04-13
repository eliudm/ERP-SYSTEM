import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalEntityType,
  InvoiceStatus,
  RecurringFrequency,
} from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { InvoicesService } from './invoices.service';
import { AuditService } from '../../audit/audit.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { CreateRecurringInvoiceTemplateDto } from '../dto/recurring/create-recurring-invoice-template.dto';
import { UpdateRecurringInvoiceTemplateDto } from '../dto/recurring/update-recurring-invoice-template.dto';

@Injectable()
export class RecurringInvoicesService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
    private auditService: AuditService,
    private workflowService: WorkflowService,
  ) {}

  async createTemplate(
    dto: CreateRecurringInvoiceTemplateDto,
    userId?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('Template must have at least one item');
    }

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
    }

    const start = new Date(dto.startDate);

    const template = await this.prisma.recurringInvoiceTemplate.create({
      data: {
        name: dto.name,
        customerId: dto.customerId,
        branchId: dto.branchId,
        frequency: dto.frequency,
        startDate: start,
        nextRunDate: start,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        autoApprove: dto.autoApprove ?? false,
        defaultPaymentMethod: dto.defaultPaymentMethod,
        notes: dto.notes,
        createdById: userId ?? null,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      tableName: 'recurring_invoice_templates',
      recordId: template.id,
      newValues: {
        name: template.name,
        customerId: template.customerId,
        frequency: template.frequency,
      },
    });

    return template;
  }

  findTemplates(isActive?: string) {
    return this.prisma.recurringInvoiceTemplate.findMany({
      where: {
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTemplate(id: string) {
    const template = await this.prisma.recurringInvoiceTemplate.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
        runs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(
    id: string,
    dto: UpdateRecurringInvoiceTemplateDto,
    userId?: string,
  ) {
    const existing = await this.prisma.recurringInvoiceTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Template not found');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    const updated = await this.prisma.recurringInvoiceTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.autoApprove !== undefined && { autoApprove: dto.autoApprove }),
        ...(dto.defaultPaymentMethod !== undefined && {
          defaultPaymentMethod: dto.defaultPaymentMethod,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      tableName: 'recurring_invoice_templates',
      recordId: id,
      oldValues: { id, name: existing.name, frequency: existing.frequency },
      newValues: {
        name: updated.name,
        frequency: updated.frequency,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async runDueTemplates(userId?: string) {
    const now = new Date();

    const templates = await this.prisma.recurringInvoiceTemplate.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { items: true },
      orderBy: { nextRunDate: 'asc' },
    });

    const results: Array<{
      templateId: string;
      invoiceId?: string;
      status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
      error?: string;
    }> = [];

    for (const template of templates) {
      try {
        if (template.items.length === 0) {
          await this.prisma.recurringInvoiceRun.create({
            data: {
              templateId: template.id,
              runDate: now,
              status: 'SKIPPED',
              errorMessage: 'Template has no items',
            },
          });
          results.push({
            templateId: template.id,
            status: 'SKIPPED',
            error: 'Template has no items',
          });
          continue;
        }

        const invoice = await this.invoicesService.create(
          {
            customerId: template.customerId,
            invoiceDate: now.toISOString(),
            dueDate: undefined,
            notes:
              template.notes ??
              `Auto-generated from recurring template: ${template.name}`,
            paymentMethod: template.defaultPaymentMethod ?? undefined,
            items: template.items.map((i) => ({
              productId: i.productId,
              description: i.description ?? undefined,
              quantity: Number(i.quantity),
              unitPrice: Number(i.unitPrice),
              taxRate: Number(i.taxRate),
            })),
          },
          userId,
        );

        if (template.autoApprove) {
          if (invoice.status === InvoiceStatus.DRAFT) {
            await this.invoicesService.approve(
              invoice.id,
              undefined,
              template.defaultPaymentMethod ?? undefined,
              userId,
            );
          }
        } else {
          await this.workflowService.createApprovalRequest(
            ApprovalEntityType.SALES_INVOICE,
            invoice.id,
            userId,
            `Recurring invoice from template ${template.name}`,
          );
        }

        await this.prisma.recurringInvoiceRun.create({
          data: {
            templateId: template.id,
            runDate: now,
            invoiceId: invoice.id,
            status: 'SUCCESS',
          },
        });

        await this.prisma.recurringInvoiceTemplate.update({
          where: { id: template.id },
          data: {
            lastRunAt: now,
            nextRunDate: this.computeNextRunDate(now, template.frequency),
          },
        });

        results.push({
          templateId: template.id,
          invoiceId: invoice.id,
          status: 'SUCCESS',
        });
      } catch (error: any) {
        await this.prisma.recurringInvoiceRun.create({
          data: {
            templateId: template.id,
            runDate: now,
            status: 'FAILED',
            errorMessage: error?.message ?? 'Unknown error',
          },
        });

        results.push({
          templateId: template.id,
          status: 'FAILED',
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return {
      totalDue: templates.length,
      succeeded: results.filter((r) => r.status === 'SUCCESS').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      skipped: results.filter((r) => r.status === 'SKIPPED').length,
      results,
    };
  }

  private computeNextRunDate(from: Date, frequency: RecurringFrequency): Date {
    const next = new Date(from);

    if (frequency === RecurringFrequency.WEEKLY) {
      next.setDate(next.getDate() + 7);
    } else if (frequency === RecurringFrequency.MONTHLY) {
      next.setMonth(next.getMonth() + 1);
    } else if (frequency === RecurringFrequency.QUARTERLY) {
      next.setMonth(next.getMonth() + 3);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }

    return next;
  }
}
