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
import { BomService } from '../services/bom.service';
import { CreateBOMDto, UpdateBOMDto, BOMLineDto } from '../dto/mrp.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('mrp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mrp/bom')
export class BomController {
  constructor(private bomService: BomService) {}

  @ApiOperation({ summary: 'Create a new bill of materials' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateBOMDto, @Req() req: any) {
    return this.bomService.create(dto, req.user?.id);
  }

  @ApiOperation({ summary: 'List bills of materials, optionally filtered by status' })
  @Get()
  findAll(@Query('status') status?: string) {
    return this.bomService.findAll(status);
  }

  @ApiOperation({ summary: 'Get a single bill of materials by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bomService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a bill of materials' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateBOMDto) {
    return this.bomService.update(id, dto);
  }

  @ApiOperation({ summary: 'Change a bill of materials\' status (draft, active, archived)' })
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  setStatus(
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
  ) {
    return this.bomService.setStatus(id, status);
  }

  @ApiOperation({ summary: 'Add or update the component lines of a bill of materials' })
  @Post(':id/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  upsertLines(@Param('id') id: string, @Body('lines') lines: BOMLineDto[]) {
    return this.bomService.upsertLines(id, lines);
  }

  @ApiOperation({ summary: 'Check component availability for producing a given quantity from a bill of materials' })
  @Get(':id/availability')
  checkAvailability(
    @Param('id') id: string,
    @Query('quantity') quantity: string,
  ) {
    return this.bomService.checkAvailability(id, Number(quantity) || 1);
  }
}
