import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

export const ALL_MODULES = [
  'pos', 'sales', 'accounting', 'inventory', 'procurement',
  'hr', 'etims', 'contacts', 'crm', 'mrp', 'analytics',
  'aiInsights', 'approvals', 'notifications', 'messaging', 'support', 'help',
] as const;
export type ModuleKey = typeof ALL_MODULES[number];
export type ModuleConfig = Record<ModuleKey, boolean>;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSystemSettings() {
    const tenantId = getCurrentTenantId()!;
    return this.prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'system' } },
      update: {},
      create: {
        tenantId,
        key: 'system',
        companyName: 'Nexora ERP',
        companyPin: 'P051234567X',
        companyAddress: 'Moi Avenue, Nairobi, Kenya',
        receiptSlogan:
          'Streamlined operations. Compliant receipts. Better business.',
        invoiceTemplate: 'modern',
        receiptTemplate: 'standard',
        defaultCurrency: 'KES',
        timezone: 'Africa/Nairobi',
        defaultLanguage: 'en-KE',
        emailNotifications: true,
        autoApproveDrafts: false,
        showLowStockAlerts: true,
        lowStockThreshold: 5,
        posReceiptBranding: true,
      },
    });
  }

  getSystemSettings() {
    return this.ensureSystemSettings();
  }

  async getModuleConfig(): Promise<ModuleConfig> {
    const settings = await this.ensureSystemSettings();
    const stored = (settings.modules ?? {}) as Partial<ModuleConfig>;
    // Default: all modules enabled when not explicitly set
    return Object.fromEntries(
      ALL_MODULES.map((m) => [m, stored[m] !== false]),
    ) as ModuleConfig;
  }

  async updateModuleConfig(updates: Partial<ModuleConfig>): Promise<ModuleConfig> {
    const current = await this.getModuleConfig();
    const merged = { ...current, ...updates };
    await this.prisma.systemSetting.update({
      where: { tenantId_key: { tenantId: getCurrentTenantId()!, key: 'system' } },
      data: { modules: merged },
    });
    return merged;
  }

  async updateSystemSettings(dto: UpdateSystemSettingsDto) {
    await this.ensureSystemSettings();

    return this.prisma.systemSetting.update({
      where: {
        tenantId_key: { tenantId: getCurrentTenantId()!, key: 'system' },
      },
      data: dto,
    });
  }
}
