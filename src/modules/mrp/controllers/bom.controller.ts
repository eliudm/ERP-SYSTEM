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
import { BomService } from '../services/bom.service';
import { CreateBOMDto, UpdateBOMDto, BOMLineDto } from '../dto/mrp.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('mrp/bom')
export class BomController {
  constructor(private bomService: BomService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateBOMDto, @Req() req: any) {
    return this.bomService.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.bomService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bomService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateBOMDto) {
    return this.bomService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  setStatus(
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
  ) {
    return this.bomService.setStatus(id, status);
  }

  @Post(':id/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  upsertLines(@Param('id') id: string, @Body('lines') lines: BOMLineDto[]) {
    return this.bomService.upsertLines(id, lines);
  }

  @Get(':id/availability')
  checkAvailability(
    @Param('id') id: string,
    @Query('quantity') quantity: string,
  ) {
    return this.bomService.checkAvailability(id, Number(quantity) || 1);
  }
}
