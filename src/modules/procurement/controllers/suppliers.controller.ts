import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @ApiOperation({ summary: 'Register a new supplier' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @ApiOperation({ summary: 'List suppliers, optionally filtered by a search term' })
  @Get()
  findAll(@Query('search') search: string) {
    return this.suppliersService.findAll(search);
  }

  @ApiOperation({ summary: 'Get a single supplier by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @ApiOperation({ summary: 'Get a supplier account statement' })
  @Get(':id/statement')
  getStatement(@Param('id') id: string) {
    return this.suppliersService.getStatement(id);
  }

  @ApiOperation({ summary: 'Update a supplier' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a supplier' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.suppliersService.deactivate(id);
  }
}
