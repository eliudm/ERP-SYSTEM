import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RegisterPluginDto, UpdatePluginConfigDto } from './dto/plugins.dto';

@Injectable()
export class PluginsService {
  constructor(private prisma: PrismaService) {}

  // ─── REGISTER PLUGIN ─────────────────────────────────────
  async register(dto: RegisterPluginDto) {
    const existing = await this.prisma.plugin.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Plugin "${dto.name}" is already registered`);
    }

    return this.prisma.plugin.create({
      data: {
        name: dto.name,
        version: dto.version,
        description: dto.description,
        author: dto.author,
        entryPoint: dto.entryPoint,
        config: dto.config ?? {},
        status: 'INACTIVE',
      },
    });
  }

  // ─── LIST ALL PLUGINS ────────────────────────────────────
  async findAll(status?: string) {
    return this.prisma.plugin.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { name: 'asc' },
    });
  }

  // ─── GET ONE ─────────────────────────────────────────────
  async findOne(id: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');
    return plugin;
  }

  // ─── ACTIVATE ────────────────────────────────────────────
  async activate(id: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.plugin.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  // ─── DEACTIVATE ──────────────────────────────────────────
  async deactivate(id: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.plugin.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ─── UPDATE CONFIG ───────────────────────────────────────
  async updateConfig(id: string, dto: UpdatePluginConfigDto) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.plugin.update({
      where: { id },
      data: {
        ...(dto.config !== undefined && { config: dto.config }),
        ...(dto.version && { version: dto.version }),
      },
    });
  }

  // ─── UNINSTALL (delete) ──────────────────────────────────
  async uninstall(id: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.plugin.delete({ where: { id } });
  }

  // ─── GET ACTIVE PLUGINS (for module loader) ──────────────
  async getActivePlugins() {
    return this.prisma.plugin.findMany({
      where: { status: 'ACTIVE' },
      select: { name: true, version: true, entryPoint: true, config: true },
    });
  }
}
