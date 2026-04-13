import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  featureFlag: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  describe('create', () => {
    const dto = {
      key: 'dark-mode',
      name: 'Dark Mode',
      description: 'Enable dark mode UI',
    };

    it('should create a new feature flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.create.mockResolvedValue({
        id: 'ff-1',
        ...dto,
        isEnabled: false,
      });

      const result = await service.create(dto);

      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'dark-mode',
          isEnabled: false,
        }),
      });
      expect(result.isEnabled).toBe(false);
    });

    it('should throw ConflictException if key already exists', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should respect isEnabled flag from dto', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.create.mockResolvedValue({
        id: 'ff-1',
        ...dto,
        isEnabled: true,
      });

      await service.create({ ...dto, isEnabled: true });

      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isEnabled: true }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all flags sorted by key', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([
        { key: 'a-flag' },
        { key: 'b-flag' },
      ]);

      const result = await service.findAll();

      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ isEnabled: true });

      expect(await service.isEnabled('dark-mode')).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ isEnabled: false });

      expect(await service.isEnabled('dark-mode')).toBe(false);
    });

    it('should return false for non-existent flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      expect(await service.isEnabled('missing')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle flag from false to true', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        key: 'dark-mode',
        isEnabled: false,
      });
      prisma.featureFlag.update.mockResolvedValue({
        key: 'dark-mode',
        isEnabled: true,
      });

      const result = await service.toggle('dark-mode');
      expect(result.isEnabled).toBe(true);
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'dark-mode' },
        data: { isEnabled: true },
      });
    });

    it('should toggle flag from true to false', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        key: 'dark-mode',
        isEnabled: true,
      });
      prisma.featureFlag.update.mockResolvedValue({
        key: 'dark-mode',
        isEnabled: false,
      });

      const result = await service.toggle('dark-mode');
      expect(result.isEnabled).toBe(false);
    });

    it('should throw NotFoundException if flag not found', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.toggle('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update flag metadata', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'dark-mode' });
      prisma.featureFlag.update.mockResolvedValue({
        key: 'dark-mode',
        name: 'New Name',
      });

      const result = await service.update('dark-mode', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if flag not found', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete the flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'dark-mode' });
      prisma.featureFlag.delete.mockResolvedValue({ key: 'dark-mode' });

      const result = await service.remove('dark-mode');
      expect(prisma.featureFlag.delete).toHaveBeenCalledWith({
        where: { key: 'dark-mode' },
      });
      expect(result.key).toBe('dark-mode');
    });

    it('should throw NotFoundException if flag not found', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllEnabled', () => {
    it('should return a map of key → isEnabled', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([
        { key: 'dark-mode', isEnabled: true },
        { key: 'beta-ui', isEnabled: false },
        { key: 'new-nav', isEnabled: true },
      ]);

      const result = await service.getAllEnabled();

      expect(result).toEqual({
        'dark-mode': true,
        'beta-ui': false,
        'new-nav': true,
      });
    });

    it('should return empty object if no flags exist', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([]);

      expect(await service.getAllEnabled()).toEqual({});
    });
  });
});
