import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from '../services/suppliers.service';

const mockSuppliersService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStatement: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
});

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: ReturnType<typeof mockSuppliersService>;

  beforeEach(async () => {
    service = mockSuppliersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [{ provide: SuppliersService, useValue: service }],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });

  describe('create', () => {
    it('should call service.create with the dto and return its result', async () => {
      const dto = { name: 'Acme' };
      const expected = { id: 'sup-1', ...dto };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with the search term', async () => {
      const expected = [{ id: 'sup-1' }];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('acme');

      expect(service.findAll).toHaveBeenCalledWith('acme');
      expect(result).toBe(expected);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the id', async () => {
      const expected = { id: 'sup-1' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('sup-1');

      expect(service.findOne).toHaveBeenCalledWith('sup-1');
      expect(result).toBe(expected);
    });
  });

  describe('getStatement', () => {
    it('should call service.getStatement with the id', async () => {
      const expected = { summary: {} };
      service.getStatement.mockResolvedValue(expected);

      const result = await controller.getStatement('sup-1');

      expect(service.getStatement).toHaveBeenCalledWith('sup-1');
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('should call service.update with the id and dto', async () => {
      const dto = { name: 'New Name' };
      const expected = { id: 'sup-1', ...dto };
      service.update.mockResolvedValue(expected);

      const result = await controller.update('sup-1', dto as any);

      expect(service.update).toHaveBeenCalledWith('sup-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('deactivate', () => {
    it('should call service.deactivate with the id', async () => {
      const expected = { id: 'sup-1', isActive: false };
      service.deactivate.mockResolvedValue(expected);

      const result = await controller.deactivate('sup-1');

      expect(service.deactivate).toHaveBeenCalledWith('sup-1');
      expect(result).toBe(expected);
    });
  });
});
