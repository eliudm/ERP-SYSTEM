import { Test, TestingModule } from '@nestjs/testing';
import { CrmService } from './crm.service';
import { PrismaService } from '../../prisma.service';
import { NotFoundException } from '@nestjs/common';
import { LeadStage } from '@prisma/client';

const mockPrisma = () => ({
  crmLead: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  crmLeadActivity: {
    create: jest.fn(),
  },
});

describe('CrmService', () => {
  let service: CrmService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CrmService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CrmService>(CrmService);
  });

  describe('createLead', () => {
    it('should create a lead defaulting stage to NEW and probability to 0', async () => {
      const dto = { title: 'Big Deal' };
      const created = { id: 'l1', title: 'Big Deal', stage: 'NEW' };
      prisma.crmLead.create.mockResolvedValue(created);

      const result = await service.createLead(dto as any, 'user-1');

      expect(prisma.crmLead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Big Deal',
          stage: LeadStage.NEW,
          probability: 0,
          expectedCloseDate: null,
          createdById: 'user-1',
        }),
      });
      expect(result).toEqual(created);
    });

    it('should use provided stage, probability and expectedCloseDate', async () => {
      prisma.crmLead.create.mockResolvedValue({ id: 'l2' });

      await service.createLead({
        title: 'Deal 2',
        stage: LeadStage.QUALIFIED,
        probability: 50,
        expectedCloseDate: '2026-01-01',
      } as any);

      expect(prisma.crmLead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stage: LeadStage.QUALIFIED,
          probability: 50,
          expectedCloseDate: new Date('2026-01-01'),
          createdById: null,
        }),
      });
    });
  });

  describe('findLeads', () => {
    it('should return all leads ordered by updatedAt desc', async () => {
      prisma.crmLead.findMany.mockResolvedValue([{ id: 'l1' }]);

      const result = await service.findLeads();

      expect(prisma.crmLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { updatedAt: 'desc' },
        }),
      );
      expect(result).toEqual([{ id: 'l1' }]);
    });

    it('should filter by stage', async () => {
      prisma.crmLead.findMany.mockResolvedValue([]);

      await service.findLeads(LeadStage.WON);

      expect(prisma.crmLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stage: LeadStage.WON } }),
      );
    });

    it('should filter by search term across title, companyName, contactName, email', async () => {
      prisma.crmLead.findMany.mockResolvedValue([]);

      await service.findLeads(undefined, 'acme');

      expect(prisma.crmLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'acme', mode: 'insensitive' } },
              { companyName: { contains: 'acme', mode: 'insensitive' } },
              { contactName: { contains: 'acme', mode: 'insensitive' } },
              { email: { contains: 'acme', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('findLead', () => {
    it('should return a lead by id with activities', async () => {
      const lead = { id: 'l1', title: 'Deal', activities: [] };
      prisma.crmLead.findUnique.mockResolvedValue(lead);

      const result = await service.findLead('l1');

      expect(prisma.crmLead.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' } }),
      );
      expect(result).toEqual(lead);
    });

    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.crmLead.findUnique.mockResolvedValue(null);

      await expect(service.findLead('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLead', () => {
    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.crmLead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLead('missing', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      const updated = { id: 'l1', title: 'New Title' };
      prisma.crmLead.update.mockResolvedValue(updated);

      const result = await service.updateLead('l1', { title: 'New Title' });

      expect(prisma.crmLead.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { title: 'New Title' },
      });
      expect(result).toEqual(updated);
    });

    it('should convert expectedCloseDate to a Date when provided', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      prisma.crmLead.update.mockResolvedValue({ id: 'l1' });

      await service.updateLead('l1', { expectedCloseDate: '2026-02-01' });

      expect(prisma.crmLead.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { expectedCloseDate: new Date('2026-02-01') },
      });
    });

    it('should set expectedCloseDate to null when explicitly cleared', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      prisma.crmLead.update.mockResolvedValue({ id: 'l1' });

      await service.updateLead('l1', { expectedCloseDate: '' as any });

      expect(prisma.crmLead.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { expectedCloseDate: null },
      });
    });
  });

  describe('updateStage', () => {
    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.crmLead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStage('missing', LeadStage.WON),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the lead stage', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      const updated = { id: 'l1', stage: LeadStage.WON };
      prisma.crmLead.update.mockResolvedValue(updated);

      const result = await service.updateStage('l1', LeadStage.WON);

      expect(prisma.crmLead.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { stage: LeadStage.WON },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('addActivity', () => {
    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.crmLead.findUnique.mockResolvedValue(null);

      await expect(
        service.addActivity('missing', { type: 'CALL', summary: 'hi' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create an activity linked to the lead', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      const activity = { id: 'a1', leadId: 'l1', summary: 'Called client' };
      prisma.crmLeadActivity.create.mockResolvedValue(activity);

      const result = await service.addActivity(
        'l1',
        { type: 'CALL', summary: 'Called client' } as any,
        'user-1',
      );

      expect(prisma.crmLeadActivity.create).toHaveBeenCalledWith({
        data: {
          leadId: 'l1',
          type: 'CALL',
          summary: 'Called client',
          dueDate: null,
          createdById: 'user-1',
        },
      });
      expect(result).toEqual(activity);
    });

    it('should convert dueDate to a Date when provided', async () => {
      prisma.crmLead.findUnique.mockResolvedValue({ id: 'l1' });
      prisma.crmLeadActivity.create.mockResolvedValue({ id: 'a1' });

      await service.addActivity('l1', {
        type: 'CALL',
        summary: 'Follow up',
        dueDate: '2026-03-01',
      } as any);

      expect(prisma.crmLeadActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dueDate: new Date('2026-03-01'),
          createdById: null,
        }),
      });
    });
  });

  describe('getPipeline', () => {
    it('should group leads by every LeadStage value', async () => {
      prisma.crmLead.findMany.mockResolvedValue([
        { id: 'l1', stage: LeadStage.NEW },
        { id: 'l2', stage: LeadStage.WON },
      ]);

      const result = await service.getPipeline();

      expect(prisma.crmLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
      expect(result[LeadStage.NEW]).toEqual([{ id: 'l1', stage: LeadStage.NEW }]);
      expect(result[LeadStage.WON]).toEqual([{ id: 'l2', stage: LeadStage.WON }]);
      expect(Object.keys(result)).toEqual(Object.values(LeadStage));
    });

    it('should return empty arrays for stages with no leads', async () => {
      prisma.crmLead.findMany.mockResolvedValue([]);

      const result = await service.getPipeline();

      for (const stage of Object.values(LeadStage)) {
        expect(result[stage]).toEqual([]);
      }
    });
  });
});
