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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // POST /sales/customers
  @ApiOperation({ summary: 'Create a new customer' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  // GET /sales/customers
  @ApiOperation({ summary: 'List customers, optionally filtered by search term' })
  @Get()
  findAll(@Query('search') search: string) {
    return this.customersService.findAll(search);
  }

  // GET /sales/customers/:id
  @ApiOperation({ summary: 'Get a customer by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  // GET /sales/customers/:id/statement
  @ApiOperation({ summary: 'Get a customer account statement' })
  @Get(':id/statement')
  getStatement(@Param('id') id: string) {
    return this.customersService.getStatement(id);
  }

  // PATCH /sales/customers/:id
  @ApiOperation({ summary: 'Update a customer' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  // PATCH /sales/customers/:id/deactivate
  @ApiOperation({ summary: 'Deactivate a customer' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.customersService.deactivate(id);
  }
}
