import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSystemSettings() {
    return this.prisma.systemSetting.upsert({
      where: { key: 'system' },
      update: {},
      create: {
        key: 'system',
        companyName: 'Nexora ERP',
        companyPin: 'P051234567X',
        companyAddress: 'Moi Avenue, Nairobi, Kenya',
        receiptSlogan:
          'Streamlined operations. Compliant receipts. Better business.',
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
      where: { key: 'system' },
      data: dto,
    });
  }
}
