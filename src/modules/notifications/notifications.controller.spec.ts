import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const mockNotificationsService = () => ({
  getUnread: jest.fn(),
  unreadCount: jest.fn(),
  findAll: jest.fn(),
  markAllRead: jest.fn(),
  markRead: jest.fn(),
  sendOverdueInvoiceReminders: jest.fn(),
});

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: ReturnType<typeof mockNotificationsService>;

  beforeEach(async () => {
    service = mockNotificationsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe('getUnread', () => {
    it('should delegate to notificationsService.getUnread', async () => {
      const expected = [{ id: 'n1' }];
      service.getUnread.mockResolvedValue(expected);

      const result = await controller.getUnread();

      expect(service.getUnread).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('unreadCount', () => {
    it('should delegate to notificationsService.unreadCount', async () => {
      service.unreadCount.mockResolvedValue({ count: 3 });

      const result = await controller.unreadCount();

      expect(service.unreadCount).toHaveBeenCalledWith();
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('findAll', () => {
    it('should parse page and limit query params and delegate', async () => {
      const expected = { data: [], meta: { total: 0, page: 2, limit: 5 } };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('2', '5');

      expect(service.findAll).toHaveBeenCalledWith(2, 5);
      expect(result).toEqual(expected);
    });

    it('should default page to 1 and limit to 20 when missing or invalid', async () => {
      service.findAll.mockResolvedValue({});

      await controller.findAll(undefined as any, undefined as any);

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('markAllRead', () => {
    it('should delegate to notificationsService.markAllRead', async () => {
      const expected = { message: 'All notifications marked as read' };
      service.markAllRead.mockResolvedValue(expected);

      const result = await controller.markAllRead();

      expect(service.markAllRead).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('markRead', () => {
    it('should delegate to notificationsService.markRead with the id', async () => {
      const expected = { id: 'n1', isRead: true };
      service.markRead.mockResolvedValue(expected);

      const result = await controller.markRead('n1');

      expect(service.markRead).toHaveBeenCalledWith('n1');
      expect(result).toEqual(expected);
    });
  });

  describe('sendOverdueReminders', () => {
    it('should parse daysOverdue and delegate to sendOverdueInvoiceReminders', async () => {
      const expected = { scanned: 2, created: 1, emailed: 1 };
      service.sendOverdueInvoiceReminders.mockResolvedValue(expected);

      const result = await controller.sendOverdueReminders('7');

      expect(service.sendOverdueInvoiceReminders).toHaveBeenCalledWith(7);
      expect(result).toEqual(expected);
    });

    it('should default daysOverdue to 0 when missing or invalid', async () => {
      service.sendOverdueInvoiceReminders.mockResolvedValue({});

      await controller.sendOverdueReminders(undefined as any);

      expect(service.sendOverdueInvoiceReminders).toHaveBeenCalledWith(0);
    });
  });
});
