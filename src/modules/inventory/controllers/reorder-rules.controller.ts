import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReorderRulesService } from '../services/reorder-rules.service';
import { CreateReorderRuleDto, UpdateReorderRuleDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/reorder-rules')
export class ReorderRulesController {
  constructor(private reorderRulesService: ReorderRulesService) {}

  @ApiOperation({ summary: 'Create a new reorder rule' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateReorderRuleDto) {
    return this.reorderRulesService.create(dto);
  }

  @ApiOperation({ summary: 'List reorder rules, by default only active ones' })
  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.reorderRulesService.findAll(activeOnly !== 'false');
  }

  @ApiOperation({ summary: 'Check stock levels against reorder rules and suggest reorders' })
  @Get('check')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  checkAndSuggest() {
    return this.reorderRulesService.checkAndSuggest();
  }

  @ApiOperation({ summary: 'Get a reorder rule by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reorderRulesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a reorder rule' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateReorderRuleDto) {
    return this.reorderRulesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a reorder rule' })
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.reorderRulesService.remove(id);
  }
}
