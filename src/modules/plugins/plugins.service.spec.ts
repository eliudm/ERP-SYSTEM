import { Test, TestingModule } from '@nestjs/testing';
import { PluginsService } from './plugins.service';
import { PrismaService } from '../../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  plugin: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

describe('PluginsService', () => {
  let service: PluginsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
  });

  describe('register', () => {
    const dto = {
      name: 'my-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      entryPoint: '/plugins/my-plugin',
    };

    it('should register a new plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);
      const expected = { id: 'plug-1', ...dto, status: 'INACTIVE' };
      prisma.plugin.create.mockResolvedValue(expected);

      const result = await service.register(dto);

      expect(prisma.plugin.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'my-plugin',
          status: 'INACTIVE',
        }),
      });
      expect(result.status).toBe('INACTIVE');
    });

    it('should throw ConflictException if name already exists', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all plugins', async () => {
      prisma.plugin.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      prisma.plugin.findMany.mockResolvedValue([]);

      await service.findAll('ACTIVE');

      expect(prisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a plugin by id', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'plug-1', name: 'x' });

      expect(await service.findOne('plug-1')).toEqual({
        id: 'plug-1',
        name: 'x',
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should set plugin status to ACTIVE', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'plug-1' });
      prisma.plugin.update.mockResolvedValue({
        id: 'plug-1',
        status: 'ACTIVE',
      });

      const result = await service.activate('plug-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.activate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('should set plugin status to INACTIVE', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'plug-1' });
      prisma.plugin.update.mockResolvedValue({
        id: 'plug-1',
        status: 'INACTIVE',
      });

      const result = await service.deactivate('plug-1');
      expect(result.status).toBe('INACTIVE');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateConfig', () => {
    it('should update plugin config and version', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'plug-1' });
      prisma.plugin.update.mockResolvedValue({
        id: 'plug-1',
        config: { key: 'val' },
        version: '2.0.0',
      });

      const result = await service.updateConfig('plug-1', {
        config: { key: 'val' },
        version: '2.0.0',
      });

      expect(prisma.plugin.update).toHaveBeenCalledWith({
        where: { id: 'plug-1' },
        data: { config: { key: 'val' }, version: '2.0.0' },
      });
      expect(result.version).toBe('2.0.0');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      await expect(
        service.updateConfig('missing', { config: {} }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uninstall', () => {
    it('should delete the plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ id: 'plug-1' });
      prisma.plugin.delete.mockResolvedValue({ id: 'plug-1' });

      const result = await service.uninstall('plug-1');
      expect(prisma.plugin.delete).toHaveBeenCalledWith({
        where: { id: 'plug-1' },
      });
      expect(result.id).toBe('plug-1');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.uninstall('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActivePlugins', () => {
    it('should return only ACTIVE plugins with selected fields', async () => {
      prisma.plugin.findMany.mockResolvedValue([
        { name: 'p1', version: '1.0', entryPoint: '/p1', config: {} },
      ]);

      const result = await service.getActivePlugins();

      expect(prisma.plugin.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { name: true, version: true, entryPoint: true, config: true },
      });
      expect(result).toHaveLength(1);
    });
  });
});
