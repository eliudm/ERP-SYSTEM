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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('budget')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @ApiOperation({ summary: 'Create a new department/fiscal-year budget' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateBudgetDto, @Req() req: any) {
    return this.budgetService.create(dto, req.user?.id);
  }

  @ApiOperation({ summary: 'List budgets, optionally filtered by fiscal year and status' })
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

  @ApiOperation({ summary: 'Get a single budget by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.budgetService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a budget' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.update(id, dto);
  }

  @ApiOperation({ summary: 'Change a budget\'s status (e.g. approve, close)' })
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  setStatus(@Param('id') id: string, @Body() dto: SetBudgetStatusDto) {
    return this.budgetService.setStatus(id, dto);
  }

  @ApiOperation({ summary: 'Add one or more budget lines to a budget' })
  @Post(':id/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  addLines(@Param('id') id: string, @Body() lines: CreateBudgetLineDto[]) {
    return this.budgetService.addLines(id, lines);
  }

  @ApiOperation({ summary: 'Delete a single line from a budget' })
  @Delete(':id/lines/:lineId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deleteLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.budgetService.deleteLine(id, lineId);
  }

  @ApiOperation({ summary: 'Compare a budget against actual spending/revenue' })
  @Get(':id/vs-actual')
  getBudgetVsActual(@Param('id') id: string) {
    return this.budgetService.getBudgetVsActual(id);
  }
}
