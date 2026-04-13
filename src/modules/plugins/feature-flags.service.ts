import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateFeatureFlagDto } from './dto/plugins.dto';

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE FLAG ─────────────────────────────────────────
  async create(dto: CreateFeatureFlagDto) {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Feature flag "${dto.key}" already exists`);
    }

    return this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        isEnabled: dto.isEnabled ?? false,
        metadata: dto.metadata ?? {},
      },
    });
  }

  // ─── LIST ALL FLAGS ──────────────────────────────────────
  async findAll() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  // ─── CHECK FLAG (lightweight for runtime use) ────────────
  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key },
      select: { isEnabled: true },
    });
    return flag?.isEnabled ?? false;
  }

  // ─── TOGGLE FLAG ─────────────────────────────────────────
  async toggle(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);

    return this.prisma.featureFlag.update({
      where: { key },
      data: { isEnabled: !flag.isEnabled },
    });
  }

  // ─── UPDATE FLAG ─────────────────────────────────────────
  async update(
    key: string,
    data: { name?: string; description?: string; metadata?: any },
  ) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);

    return this.prisma.featureFlag.update({
      where: { key },
      data,
    });
  }

  // ─── DELETE FLAG ─────────────────────────────────────────
  async remove(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);

    return this.prisma.featureFlag.delete({ where: { key } });
  }

  // ─── BULK CHECK (for frontend init) ──────────────────────
  async getAllEnabled(): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({
      select: { key: true, isEnabled: true },
    });
    return Object.fromEntries(flags.map((f) => [f.key, f.isEnabled]));
  }
}
