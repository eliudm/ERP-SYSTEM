import { Module } from '@nestjs/common';
import { ProductsController } from './controllers/products.controller';
import { ProductCategoriesController } from './controllers/product-categories.controller';
import { WarehousesController } from './controllers/warehouses.controller';
import { StockMovementsController } from './controllers/stock-movements.controller';
import { LotsController } from './controllers/lots.controller';
import { SerialNumbersController } from './controllers/serial-numbers.controller';
import { LandedCostsController } from './controllers/landed-costs.controller';
import { StockCountsController } from './controllers/stock-counts.controller';
import { StockTransfersController } from './controllers/stock-transfers.controller';
import { ProductsService } from './services/products.service';
import { ProductCategoriesService } from './services/product-categories.service';
import { WarehousesService } from './services/warehouses.service';
import { StockMovementsService } from './services/stock-movements.service';
import { LotsService } from './services/lots.service';
import { SerialNumbersService } from './services/serial-numbers.service';
import { LandedCostsService } from './services/landed-costs.service';
import { StockCountsService } from './services/stock-counts.service';
import { StockTransfersService } from './services/stock-transfers.service';
import { AccountingModule } from '../accounting/accounting.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AccountingModule, NotificationsModule],
  controllers: [
    ProductsController,
    ProductCategoriesController,
    WarehousesController,
    StockMovementsController,
    LotsController,
    SerialNumbersController,
    LandedCostsController,
    StockCountsController,
    StockTransfersController,
  ],
  providers: [
    ProductsService,
    ProductCategoriesService,
    WarehousesService,
    StockMovementsService,
    LotsService,
    SerialNumbersService,
    LandedCostsService,
    StockCountsService,
    StockTransfersService,
  ],
  exports: [ProductsService, StockMovementsService],
})
export class InventoryModule {}
