import { Module } from '@nestjs/common';
import { SuppliersController } from './controllers/suppliers.controller';
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';
import { RFQController } from './controllers/rfq.controller';
import { VendorBillsController } from './controllers/vendor-bills.controller';
import { PurchaseReturnsController } from './controllers/purchase-returns.controller';
import { SuppliersService } from './services/suppliers.service';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { RFQService } from './services/rfq.service';
import { VendorBillsService } from './services/vendor-bills.service';
import { PurchaseReturnsService } from './services/purchase-returns.service';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [AccountingModule, InventoryModule, WorkflowModule],
  controllers: [
    SuppliersController,
    PurchaseOrdersController,
    RFQController,
    VendorBillsController,
    PurchaseReturnsController,
  ],
  providers: [
    SuppliersService,
    PurchaseOrdersService,
    RFQService,
    VendorBillsService,
    PurchaseReturnsService,
  ],
  exports: [PurchaseOrdersService, VendorBillsService],
})
export class ProcurementModule {}
