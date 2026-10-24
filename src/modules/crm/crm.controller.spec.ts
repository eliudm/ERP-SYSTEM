import { Test, TestingModule } from '@nestjs/testing';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LeadStage } from '@prisma/client';

const mockService = () => ({
  findLeads: jest.fn(),
  getPipeline: jest.fn(),
  findLead: jest.fn(),
  createLead: jest.fn(),
  updateLead: jest.fn(),
  updateStage: jest.fn(),
  addActivity: jest.fn(),
});

describe('CrmController', () => {
  let controller: CrmController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    service = mockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrmController],
      providers: [{ provide: CrmService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CrmController>(CrmController);
  });

  describe('findLeads', () => {
    it('should call crmService.findLeads with stage and search', () => {
      service.findLeads.mockReturnValue(['lead']);

      const result = controller.findLeads(LeadStage.NEW, 'acme');

      expect(service.findLeads).toHaveBeenCalledWith(LeadStage.NEW, 'acme');
      expect(result).toEqual(['lead']);
    });
  });

  describe('getPipeline', () => {
    it('should call crmService.getPipeline', () => {
      service.getPipeline.mockReturnValue({ NEW: [] });

      const result = controller.getPipeline();

      expect(service.getPipeline).toHaveBeenCalled();
      expect(result).toEqual({ NEW: [] });
    });
  });

  describe('findLead', () => {
    it('should call crmService.findLead with id', async () => {
      service.findLead.mockResolvedValue({ id: 'l1' });

      const result = await controller.findLead('l1');

      expect(service.findLead).toHaveBeenCalledWith('l1');
      expect(result).toEqual({ id: 'l1' });
    });
  });

  describe('createLead', () => {
    it('should call crmService.createLead with dto and req.user id', async () => {
      const dto = { title: 'Big Deal' } as any;
      service.createLead.mockResolvedValue({ id: 'l1', ...dto });

      const result = await controller.createLead(dto, {
        user: { id: 'user-1' },
      } as any);

      expect(service.createLead).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual({ id: 'l1', title: 'Big Deal' });
    });

    it('should pass undefined userId when req.user is missing', async () => {
      const dto = { title: 'Deal' } as any;
      service.createLead.mockResolvedValue({ id: 'l1' });

      await controller.createLead(dto, {} as any);

      expect(service.createLead).toHaveBeenCalledWith(dto, undefined);
    });
  });

  describe('updateLead', () => {
    it('should call crmService.updateLead with id and dto', async () => {
      const dto = { title: 'New Title' } as any;
      service.updateLead.mockResolvedValue({ id: 'l1', ...dto });

      const result = await controller.updateLead('l1', dto);

      expect(service.updateLead).toHaveBeenCalledWith('l1', dto);
      expect(result).toEqual({ id: 'l1', title: 'New Title' });
    });
  });

  describe('updateStage', () => {
    it('should call crmService.updateStage with id and stage', async () => {
      service.updateStage.mockResolvedValue({ id: 'l1', stage: LeadStage.WON });

      const result = await controller.updateStage('l1', {
        stage: LeadStage.WON,
      });

      expect(service.updateStage).toHaveBeenCalledWith('l1', LeadStage.WON);
      expect(result).toEqual({ id: 'l1', stage: LeadStage.WON });
    });
  });

  describe('addActivity', () => {
    it('should call crmService.addActivity with id, dto and req.user id', async () => {
      const dto = { type: 'CALL', summary: 'Called client' } as any;
      service.addActivity.mockResolvedValue({ id: 'a1', ...dto });

      const result = await controller.addActivity('l1', dto, {
        user: { id: 'user-1' },
      } as any);

      expect(service.addActivity).toHaveBeenCalledWith('l1', dto, 'user-1');
      expect(result).toEqual({ id: 'a1', type: 'CALL', summary: 'Called client' });
    });
  });
});
