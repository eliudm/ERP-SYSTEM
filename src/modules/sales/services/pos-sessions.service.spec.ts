import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PosSessionsService } from './pos-sessions.service';
import { PrismaService } from '../../../prisma.service';

const mockPrisma = () => ({
  posSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
});

describe('PosSessionsService', () => {
  let service: PosSessionsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosSessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PosSessionsService>(PosSessionsService);
  });

  describe('openSession', () => {
    it('returns the existing OPEN session instead of creating a second one', async () => {
      const existing = { id: 'sess-1', status: 'OPEN', cashierId: 'user-1' };
      prisma.posSession.findFirst.mockResolvedValue(existing);

      const result = await service.openSession('user-1', {});

      expect(result).toBe(existing);
      expect(prisma.posSession.create).not.toHaveBeenCalled();
    });

    it('creates a new session with a generated sessionRef when none is open', async () => {
      prisma.posSession.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        code: 'MAIN',
      });
      prisma.posSession.count.mockResolvedValue(4);
      const created = { id: 'sess-2', sessionRef: 'MAIN/00005' };
      prisma.posSession.create.mockResolvedValue(created);

      const result = await service.openSession('user-1', {
        branchId: 'branch-1',
      });

      expect(prisma.posSession.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          sessionRef: 'MAIN/00005',
          cashierId: 'user-1',
          branchId: 'branch-1',
          status: 'OPEN',
        },
      });
      expect(result).toBe(created);
    });

    it('falls back to a "POS" prefix when no branch is given', async () => {
      prisma.posSession.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
      });
      prisma.posSession.count.mockResolvedValue(0);
      prisma.posSession.create.mockResolvedValue({});

      await service.openSession('user-1', {});

      expect(prisma.posSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionRef: 'POS/00001' }),
        }),
      );
    });

    it("falls back to the cashier's assigned branch when none is given explicitly", async () => {
      prisma.posSession.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        branchId: 'branch-9',
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: 'branch-9',
        code: 'WEST',
      });
      prisma.posSession.count.mockResolvedValue(2);
      prisma.posSession.create.mockResolvedValue({});

      await service.openSession('user-1', {});

      expect(prisma.posSession.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          sessionRef: 'WEST/00003',
          cashierId: 'user-1',
          branchId: 'branch-9',
          status: 'OPEN',
        },
      });
    });

    it("prefers an explicitly-given branch over the cashier's assigned one", async () => {
      prisma.posSession.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        branchId: 'branch-9',
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        code: 'MAIN',
      });
      prisma.posSession.count.mockResolvedValue(0);
      prisma.posSession.create.mockResolvedValue({});

      await service.openSession('user-1', { branchId: 'branch-1' });

      expect(prisma.posSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ branchId: 'branch-1' }),
        }),
      );
    });

    it('throws NotFoundException if the cashier does not exist', async () => {
      prisma.posSession.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.openSession('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('closeSession', () => {
    it('closes an OPEN session with the given note/counts', async () => {
      prisma.posSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'OPEN',
      });
      prisma.posSession.update.mockResolvedValue({
        id: 'sess-1',
        status: 'CLOSED',
      });

      await service.closeSession('sess-1', {
        closingNote: 'Short by 50',
        closingCounts: { CASH: 1200 },
      });

      expect(prisma.posSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({
            status: 'CLOSED',
            closingNote: 'Short by 50',
            closingCounts: { CASH: 1200 },
          }),
        }),
      );
    });

    it('throws BadRequestException if the session does not exist', async () => {
      prisma.posSession.findUnique.mockResolvedValue(null);

      await expect(service.closeSession('missing', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if the session is already closed', async () => {
      prisma.posSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'CLOSED',
      });

      await expect(service.closeSession('sess-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getCurrentSession', () => {
    it("returns the cashier's open session", async () => {
      const open = { id: 'sess-1', status: 'OPEN' };
      prisma.posSession.findFirst.mockResolvedValue(open);

      const result = await service.getCurrentSession('user-1');

      expect(prisma.posSession.findFirst).toHaveBeenCalledWith({
        where: { cashierId: 'user-1', status: 'OPEN' },
      });
      expect(result).toBe(open);
    });
  });
});
