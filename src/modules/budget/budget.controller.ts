import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BudgetStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BudgetService } from './budget.service';
import {
  CreateBudgetDto,
  CreateBudgetLineDto,
  SetBudgetStatusDto,
  UpdateBudgetDto,
} from './budget.dto';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateBudgetDto, @Req() req: any) {
    return this.budgetService.create(dto, req.user?.id);
  }

  @Get()
  findAll(
    @Query('fiscalYear') fiscalYear?: string,
    @Query('status') status?: BudgetStatus,
  ) {
    return this.budgetService.findAll(
      fiscalYear ? +fiscalYear : undefined,
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.budgetService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  setStatus(@Param('id') id: string, @Body() dto: SetBudgetStatusDto) {
    return this.budgetService.setStatus(id, dto);
  }

  @Post(':id/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  addLines(@Param('id') id: string, @Body() lines: CreateBudgetLineDto[]) {
    return this.budgetService.addLines(id, lines);
  }

  @Delete(':id/lines/:lineId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deleteLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.budgetService.deleteLine(id, lineId);
  }

  @Get(':id/vs-actual')
  getBudgetVsActual(@Param('id') id: string) {
    return this.budgetService.getBudgetVsActual(id);
  }
}
