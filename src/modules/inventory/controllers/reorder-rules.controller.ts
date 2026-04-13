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
import { ReorderRulesService } from '../services/reorder-rules.service';
import { CreateReorderRuleDto, UpdateReorderRuleDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/reorder-rules')
export class ReorderRulesController {
  constructor(private reorderRulesService: ReorderRulesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateReorderRuleDto) {
    return this.reorderRulesService.create(dto);
  }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.reorderRulesService.findAll(activeOnly !== 'false');
  }

  @Get('check')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  checkAndSuggest() {
    return this.reorderRulesService.checkAndSuggest();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reorderRulesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateReorderRuleDto) {
    return this.reorderRulesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.reorderRulesService.remove(id);
  }
}
