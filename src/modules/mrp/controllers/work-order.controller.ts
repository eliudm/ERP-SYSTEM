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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkOrderService } from '../services/work-order.service';
import { CreateWorkOrderDto } from '../dto/mrp.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('mrp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mrp/work-orders')
export class WorkOrderController {
  constructor(private workOrderService: WorkOrderService) {}

  @ApiOperation({ summary: 'Create a new work order' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateWorkOrderDto, @Req() req: any) {
    return this.workOrderService.create(dto, req.user?.id);
  }

  @ApiOperation({ summary: 'List work orders, optionally filtered by status' })
  @Get()
  findAll(@Query('status') status?: string) {
    return this.workOrderService.findAll(status);
  }

  @ApiOperation({ summary: 'Get a single work order by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workOrderService.findOne(id);
  }

  @ApiOperation({ summary: 'Confirm a work order' })
  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  confirm(@Param('id') id: string) {
    return this.workOrderService.confirm(id);
  }

  @ApiOperation({ summary: 'Start production on a work order' })
  @Patch(':id/start')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  startProduction(@Param('id') id: string) {
    return this.workOrderService.startProduction(id);
  }

  @ApiOperation({ summary: 'Mark a work order as complete' })
  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  complete(@Param('id') id: string) {
    return this.workOrderService.complete(id);
  }

  @ApiOperation({ summary: 'Cancel a work order (admin only)' })
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.workOrderService.cancel(id);
  }
}
