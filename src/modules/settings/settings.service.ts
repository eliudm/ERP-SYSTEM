import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

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
