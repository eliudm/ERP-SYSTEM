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
import { CustomersService } from '../services/customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('sales/customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // POST /sales/customers
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  // GET /sales/customers
  @Get()
  findAll(@Query('search') search: string) {
    return this.customersService.findAll(search);
  }

  // GET /sales/customers/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  // GET /sales/customers/:id/statement
  @Get(':id/statement')
  getStatement(@Param('id') id: string) {
    return this.customersService.getStatement(id);
  }

  // PATCH /sales/customers/:id
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  // PATCH /sales/customers/:id/deactivate
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.customersService.deactivate(id);
  }
}
