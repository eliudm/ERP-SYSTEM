import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockService = () => ({
  findAll: jest.fn(),
  getCompanies: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ContactsController', () => {
  let controller: ContactsController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    service = mockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  describe('findAll', () => {
    it('should call contactsService.findAll with search and type', () => {
      service.findAll.mockReturnValue(['a']);

      const result = controller.findAll('acme', 'COMPANY' as any);

      expect(service.findAll).toHaveBeenCalledWith('acme', 'COMPANY');
      expect(result).toEqual(['a']);
    });
  });

  describe('getCompanies', () => {
    it('should call contactsService.getCompanies with search', () => {
      service.getCompanies.mockReturnValue(['comp']);

      const result = controller.getCompanies('acme');

      expect(service.getCompanies).toHaveBeenCalledWith('acme');
      expect(result).toEqual(['comp']);
    });
  });

  describe('findOne', () => {
    it('should call contactsService.findOne with id', async () => {
      service.findOne.mockResolvedValue({ id: 'c1' });

      const result = await controller.findOne('c1');

      expect(service.findOne).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ id: 'c1' });
    });
  });

  describe('create', () => {
    it('should call contactsService.create with dto', async () => {
      const dto = { name: 'Jane' } as any;
      service.create.mockResolvedValue({ id: 'c1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'c1', name: 'Jane' });
    });
  });

  describe('update', () => {
    it('should call contactsService.update with id and dto', async () => {
      const dto = { name: 'New Name' } as any;
      service.update.mockResolvedValue({ id: 'c1', ...dto });

      const result = await controller.update('c1', dto);

      expect(service.update).toHaveBeenCalledWith('c1', dto);
      expect(result).toEqual({ id: 'c1', name: 'New Name' });
    });
  });

  describe('remove', () => {
    it('should call contactsService.remove with id', async () => {
      service.remove.mockResolvedValue({ id: 'c1', isActive: false });

      const result = await controller.remove('c1');

      expect(service.remove).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ id: 'c1', isActive: false });
    });
  });
});
