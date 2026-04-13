import { Module } from '@nestjs/common';
import { BomController } from './controllers/bom.controller';
import { WorkOrderController } from './controllers/work-order.controller';
import { BomService } from './services/bom.service';
import { WorkOrderService } from './services/work-order.service';

@Module({
  controllers: [BomController, WorkOrderController],
  providers: [BomService, WorkOrderService],
  exports: [BomService, WorkOrderService],
})
export class MrpModule {}
