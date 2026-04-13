import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkOrderService } from '../services/work-order.service';
import { CreateWorkOrderDto } from '../dto/mrp.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('mrp/work-orders')
export class WorkOrderController {
  constructor(private workOrderService: WorkOrderService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateWorkOrderDto, @Req() req: any) {
    return this.workOrderService.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.workOrderService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workOrderService.findOne(id);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  confirm(@Param('id') id: string) {
    return this.workOrderService.confirm(id);
  }

  @Patch(':id/start')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  startProduction(@Param('id') id: string) {
    return this.workOrderService.startProduction(id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  complete(@Param('id') id: string) {
    return this.workOrderService.complete(id);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.workOrderService.cancel(id);
  }
}
