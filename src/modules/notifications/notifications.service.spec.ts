import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../../mail.service';
import { NotificationType, Role } from '@prisma/client';

const mockPrisma = () => ({
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
  systemSetting: {
    findFirst: jest.fn(),
  },
  salesInvoice: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
});

const mockMailService = () => ({
  sendMail: jest.fn(),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let mailService: ReturnType<typeof mockMailService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    mailService = mockMailService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('getUnread', () => {
    it('should return the latest 50 unread notifications', async () => {
      const list = [{ id: 'n1', isRead: false }];
      prisma.notification.findMany.mockResolvedValue(list);

      const result = await service.getUnread();

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(list);
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default page/limit', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: [{ id: 'n1' }],
        meta: { total: 1, page: 1, limit: 20 },
      });
    });

    it('should apply skip based on page and limit', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(45);

      const result = await service.findAll(3, 10);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.meta).toEqual({ total: 45, page: 3, limit: 10 });
    });
  });

  describe('markRead', () => {
    it('should mark a single notification as read', async () => {
      const expected = { id: 'n1', isRead: true };
      prisma.notification.update.mockResolvedValue(expected);

      const result = await service.markRead('n1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { isRead: true },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead();

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual({ message: 'All notifications marked as read' });
    });
  });

  describe('unreadCount', () => {
    it('should return the count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(7);

      const result = await service.unreadCount();

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { isRead: false },
      });
      expect(result).toEqual({ count: 7 });
    });
  });

  describe('checkAndNotifyLowStock', () => {
    const product = {
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Widget',
      code: 'W-1',
      isActive: true,
      stockQuantity: 3,
    };

    it('should do nothing when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await service.checkAndNotifyLowStock('missing');

      expect(prisma.systemSetting.findFirst).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should do nothing when the product is inactive', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...product,
        isActive: false,
      });

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should do nothing when stock is above the threshold', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...product,
        stockQuantity: 10,
      });
      prisma.systemSetting.findFirst.mockResolvedValue({
        lowStockThreshold: 5,
      });

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.systemSetting.findFirst).toHaveBeenCalledWith({
        where: { key: 'system', tenantId: 'tenant-1' },
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should default the threshold to 5 when no system setting exists', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...product,
        stockQuantity: 6,
      });
      prisma.systemSetting.findFirst.mockResolvedValue(null);

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should skip creating a notification if an unread one already exists', async () => {
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.systemSetting.findFirst.mockResolvedValue({
        lowStockThreshold: 5,
      });
      prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should create a LOW_STOCK notification and email admins/accountants', async () => {
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.systemSetting.findFirst.mockResolvedValue({
        lowStockThreshold: 5,
      });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        title: 'Low stock: Widget',
        message: 'Widget (W-1) has only 3 units remaining. Reorder soon.',
      });
      prisma.user.findMany.mockResolvedValue([
        { email: 'admin@x.com' },
        { email: 'accountant@x.com' },
      ]);

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.LOW_STOCK,
          title: 'Low stock: Widget',
          message: 'Widget (W-1) has only 3 units remaining. Reorder soon.',
          productId: 'prod-1',
        },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true, role: { in: [Role.ADMIN, Role.ACCOUNTANT] } },
        select: { email: true },
      });
      expect(mailService.sendMail).toHaveBeenCalledTimes(2);
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: 'admin@x.com',
        subject: 'Low stock: Widget',
        html: '<p>Widget (W-1) has only 3 units remaining. Reorder soon.</p>',
      });
    });

    it('should create an OUT_OF_STOCK notification when quantity is zero', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...product,
        stockQuantity: 0,
      });
      prisma.systemSetting.findFirst.mockResolvedValue({
        lowStockThreshold: 5,
      });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        title: 'Out of stock: Widget',
        message: 'Widget (W-1) is out of stock. Please reorder immediately.',
      });
      prisma.user.findMany.mockResolvedValue([]);

      await service.checkAndNotifyLowStock('prod-1');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: NotificationType.OUT_OF_STOCK }),
      });
    });
  });

  describe('sendOverdueInvoiceReminders', () => {
    const invoice = (overrides: Record<string, any> = {}) => ({
      id: 'inv-1',
      tenantId: 'tenant-1',
      invoiceNo: 'INV-001',
      total: 100,
      customer: { name: 'Acme', email: 'acme@x.com' },
      ...overrides,
    });

    it('should scan overdue invoices and return zero when none exist', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);
      prisma.notification.findMany.mockResolvedValue([]);

      const result = await service.sendOverdueInvoiceReminders(5);

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['APPROVED', 'SENT'] },
          }),
        }),
      );
      expect(result).toEqual({ scanned: 0, created: 0, emailed: 0 });
    });

    it('should create and email a reminder for an overdue invoice with a customer email', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([invoice()]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
      prisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        sentViaEmail: true,
      });

      const result = await service.sendOverdueInvoiceReminders();

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.PAYMENT_REMINDER,
          title: 'Payment reminder: INV-001',
          message: expect.stringContaining('INV-001'),
          invoiceId: 'inv-1',
          recipientEmail: 'acme@x.com',
          sentViaEmail: false,
        },
      });
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: 'acme@x.com',
        subject: 'Payment Reminder: INV-001',
        html: expect.stringContaining('INV-001'),
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { sentViaEmail: true },
      });
      expect(result).toEqual({ scanned: 1, created: 1, emailed: 1 });
    });

    it('should create a reminder without emailing when the customer has no email', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        invoice({ customer: { name: 'Acme', email: null } }),
      ]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      const result = await service.sendOverdueInvoiceReminders();

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toEqual({ scanned: 1, created: 1, emailed: 0 });
    });

    it('should skip invoices that already have an unread reminder', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([invoice()]);
      prisma.notification.findMany.mockResolvedValue([{ invoiceId: 'inv-1' }]);

      const result = await service.sendOverdueInvoiceReminders();

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(result).toEqual({ scanned: 1, created: 0, emailed: 0 });
    });
  });

  describe('notifyApprovalRequired', () => {
    it('should create an APPROVAL_REQUIRED notification and email admins/accountants', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.user.findMany.mockResolvedValue([{ email: 'admin@x.com' }]);
      const dueAt = new Date('2024-05-01T10:30:00Z');

      await service.notifyApprovalRequired(
        'tenant-1',
        'SALES_INVOICE',
        'inv-1',
        Role.ACCOUNTANT,
        dueAt,
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.APPROVAL_REQUIRED,
          title: 'Approval required: SALES_INVOICE',
          message: expect.stringContaining('ACCOUNTANT'),
        },
      });
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: 'admin@x.com',
        subject: 'Approval required: SALES_INVOICE',
        html: expect.any(String),
      });
    });

    it('should default the role label to ADMIN and due label to N/A when omitted', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.user.findMany.mockResolvedValue([]);

      await service.notifyApprovalRequired(
        'tenant-1',
        'PURCHASE_ORDER',
        'po-1',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('ADMIN'),
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('Due: N/A'),
        }),
      });
    });
  });

  describe('notifyApprovalDecision', () => {
    it('should create an APPROVAL_APPROVED notification and email the recipient', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.notification.update.mockResolvedValue({ id: 'n1' });

      await service.notifyApprovalDecision(
        'tenant-1',
        'APPROVED',
        'SALES_INVOICE',
        'inv-1',
        'requester@x.com',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.APPROVAL_APPROVED,
          title: 'APPROVED: SALES_INVOICE',
          message: 'SALES_INVOICE inv-1 has been approved.',
          recipientEmail: 'requester@x.com',
          sentViaEmail: false,
        },
      });
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: 'requester@x.com',
        subject: 'APPROVED: SALES_INVOICE',
        html: '<p>SALES_INVOICE inv-1 has been approved.</p>',
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { sentViaEmail: true },
      });
    });

    it('should create an APPROVAL_REJECTED notification including the reason', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.notifyApprovalDecision(
        'tenant-1',
        'REJECTED',
        'PURCHASE_ORDER',
        'po-1',
        undefined,
        'Budget exceeded',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.APPROVAL_REJECTED,
          title: 'REJECTED: PURCHASE_ORDER',
          message:
            'PURCHASE_ORDER po-1 has been rejected. Reason: Budget exceeded',
          recipientEmail: null,
          sentViaEmail: false,
        },
      });
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('notifyApprovalOverdue', () => {
    it('should create a SYSTEM notification and email admins/accountants', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.user.findMany.mockResolvedValue([{ email: 'admin@x.com' }]);
      const dueAt = new Date('2024-05-01T00:00:00Z');

      await service.notifyApprovalOverdue(
        'tenant-1',
        'PAYROLL',
        'payroll-1',
        dueAt,
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          type: NotificationType.SYSTEM,
          title: 'Overdue approval: PAYROLL',
          message: 'PAYROLL payroll-1 is overdue for approval (due 2024-05-01).',
        },
      });
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: 'admin@x.com',
        subject: 'Overdue approval: PAYROLL',
        html: expect.any(String),
      });
    });

    it('should use N/A when dueAt is not provided', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.user.findMany.mockResolvedValue([]);

      await service.notifyApprovalOverdue('tenant-1', 'PAYROLL', 'payroll-1');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('due N/A'),
        }),
      });
    });
  });
});
