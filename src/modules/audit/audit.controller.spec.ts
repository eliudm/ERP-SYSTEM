import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

const mockAuditService = () => ({
  findAll: jest.fn(),
});

describe('AuditController', () => {
  let controller: AuditController;
  let service: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    service = mockAuditService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: service }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  describe('findAll', () => {
    it('should parse page/limit and call auditService.findAll', async () => {
      const expected = { data: [], meta: {} };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('2', '20', 'invoices', 'CREATE');

      expect(service.findAll).toHaveBeenCalledWith(2, 20, 'invoices', 'CREATE');
      expect(result).toEqual(expected);
    });

    it('should default page to 1 and limit to 50 when missing/invalid', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll('', '', undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(1, 50, undefined, undefined);
    });
  });
});
