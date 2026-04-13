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
import { ContactsModule } from './modules/contacts/contacts.module';
import { CrmModule } from './modules/crm/crm.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AuditModule } from './modules/audit/audit.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { BudgetModule } from './modules/budget/budget.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MrpModule } from './modules/mrp/mrp.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';

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
    ContactsModule,
    CrmModule,
    DashboardModule,
    BranchesModule,
    AuditModule,
    WorkflowModule,
    BudgetModule,
    AnalyticsModule,
    MrpModule,
    MobileModule,
    PluginsModule,
    AiInsightsModule,
  ],
})
export class AppModule {}
