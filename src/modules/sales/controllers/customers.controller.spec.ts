import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from '../services/customers.service';

const mockCustomersService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStatement: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
});

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: ReturnType<typeof mockCustomersService>;

  beforeEach(async () => {
    service = mockCustomersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: service },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  describe('create', () => {
    it('should call customersService.create with the dto', async () => {
      const dto = { name: 'Jane Doe', email: 'jane@example.com' };
      const expected = { id: 'cust-1', ...dto };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should call customersService.findAll with the search term', async () => {
      const expected = [{ id: 'cust-1' }];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('jane');

      expect(service.findAll).toHaveBeenCalledWith('jane');
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call customersService.findOne with the id', async () => {
      const expected = { id: 'cust-1' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('cust-1');

      expect(service.findOne).toHaveBeenCalledWith('cust-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getStatement', () => {
    it('should call customersService.getStatement with the id', async () => {
      const expected = { customer: {}, summary: {} };
      service.getStatement.mockResolvedValue(expected);

      const result = await controller.getStatement('cust-1');

      expect(service.getStatement).toHaveBeenCalledWith('cust-1');
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should call customersService.update with the id and dto', async () => {
      const dto = { name: 'New Name' };
      const expected = { id: 'cust-1', ...dto };
      service.update.mockResolvedValue(expected);

      const result = await controller.update('cust-1', dto as any);

      expect(service.update).toHaveBeenCalledWith('cust-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('deactivate', () => {
    it('should call customersService.deactivate with the id', async () => {
      const expected = { id: 'cust-1', isActive: false };
      service.deactivate.mockResolvedValue(expected);

      const result = await controller.deactivate('cust-1');

      expect(service.deactivate).toHaveBeenCalledWith('cust-1');
      expect(result).toEqual(expected);
    });
  });
});
