import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma.service';

const mockPrisma = () => ({
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

describe('AuditService', () => {
  let service: AuditService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('should create an audit log entry with the given input', () => {
      const input = {
        userId: 'user-1',
        action: 'CREATE',
        tableName: 'invoices',
        recordId: 'inv-1',
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'APPROVED' },
        ipAddress: '127.0.0.1',
      };
      const expected = { id: 'log-1', ...input };
      prisma.auditLog.create.mockResolvedValue(expected);

      const result = service.log(input);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          tableName: 'invoices',
          recordId: 'inv-1',
          oldValues: { status: 'DRAFT' },
          newValues: { status: 'APPROVED' },
          ipAddress: '127.0.0.1',
        }),
      });
      return expect(result).resolves.toEqual(expected);
    });

    it('should default optional fields to null/undefined when omitted', () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      service.log({ action: 'DELETE', tableName: 'accounts' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          action: 'DELETE',
          tableName: 'accounts',
          recordId: null,
          oldValues: undefined,
          newValues: undefined,
          ipAddress: null,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default page/limit', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        where: {},
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: [{ id: 'log-1' }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      });
    });

    it('should apply pagination, tableName and action filters', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(25);

      const result = await service.findAll(2, 10, 'invoices', 'CREATE');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        where: { tableName: 'invoices', action: 'CREATE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: { tableName: 'invoices', action: 'CREATE' },
      });
      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });
  });
});
