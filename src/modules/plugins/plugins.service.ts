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
    const existing = await this.prisma.plugin.findFirst({
      where: { OR: [{ name: dto.name }, ...(dto.slug ? [{ slug: dto.slug }] : [])] },
    });
    if (existing) {
      throw new ConflictException(`Plugin "${dto.name}" is already installed`);
    }

    return this.prisma.plugin.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        version: dto.version,
        description: dto.description,
        author: dto.author,
        category: dto.category ?? 'custom',
        websiteUrl: dto.websiteUrl,
        logoUrl: dto.logoUrl,
        entryPoint: dto.entryPoint ?? '',
        config: dto.config ?? {},
        configSchema: dto.configSchema,
        pageUrl: dto.pageUrl,
        pageLabel: dto.pageLabel,
        pageIcon: dto.pageIcon,
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
        ...(dto.pageUrl !== undefined && { pageUrl: dto.pageUrl }),
        ...(dto.pageLabel !== undefined && { pageLabel: dto.pageLabel }),
        ...(dto.pageIcon !== undefined && { pageIcon: dto.pageIcon }),
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

  // ─── GET ACTIVE IFRAME PLUGINS (for nav injection) ───────
  async getActivePagePlugins() {
    return this.prisma.plugin.findMany({
      where: { status: 'ACTIVE', NOT: { pageUrl: null } },
      select: { id: true, name: true, pageUrl: true, pageLabel: true, pageIcon: true },
      orderBy: { name: 'asc' },
    });
  }
}
