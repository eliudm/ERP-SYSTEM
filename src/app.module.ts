import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { MailService } from './mail.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { SalesModule } from './modules/sales/sales.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { HrModule } from './modules/hr/hr.module';
import { EtimsModule } from './modules/etims/etims.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TaxModule } from './modules/tax/tax.module';

@Module({
  controllers: [AppController],
  providers: [MailService],
  exports: [MailService],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AccountingModule,
    SalesModule,
    InventoryModule,
    ProcurementModule,
    HrModule,
    EtimsModule,
    SettingsModule,
    NotificationsModule,
    TaxModule,
  ],
})
export class AppModule {}
