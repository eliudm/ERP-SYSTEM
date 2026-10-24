import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BankReconciliationService,
  CreateBankAccountDto,
  CreateBankStatementDto,
  CreateBankStatementLineDto,
} from '../services/bank-reconciliation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/bank-accounts')
export class BankAccountsController {
  constructor(private bankService: BankReconciliationService) {}

  // ─── BANK ACCOUNTS ───────────────────────────────────────
  @ApiOperation({ summary: 'Create a new bank account' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankService.createBankAccount(dto);
  }

  @ApiOperation({ summary: 'List all bank accounts' })
  @Get()
  findAll() {
    return this.bankService.findAllBankAccounts();
  }

  @ApiOperation({ summary: 'Get a single bank account by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bankService.findOneBankAccount(id);
  }

  @ApiOperation({ summary: 'Deactivate a bank account' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.bankService.deactivateBankAccount(id);
  }

  // ─── STATEMENTS ──────────────────────────────────────────
  @ApiOperation({ summary: 'Create a new bank statement for a bank account' })
  @Post(':id/statements')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createStatement(
    @Param('id') id: string,
    @Body() dto: CreateBankStatementDto,
  ) {
    return this.bankService.createStatement(id, dto);
  }

  @ApiOperation({ summary: 'List all statements for a bank account' })
  @Get(':id/statements')
  findStatements(@Param('id') id: string) {
    return this.bankService.findStatements(id);
  }

  @ApiOperation({ summary: 'Get a single bank statement by id' })
  @Get(':id/statements/:stmtId')
  findOneStatement(@Param('stmtId') stmtId: string) {
    return this.bankService.findOneStatement(stmtId);
  }

  // ─── STATEMENT LINES ─────────────────────────────────────
  @ApiOperation({ summary: 'Add a single line to a bank statement' })
  @Post(':id/statements/:stmtId/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  addLine(
    @Param('stmtId') stmtId: string,
    @Body() dto: CreateBankStatementLineDto,
  ) {
    return this.bankService.addStatementLine(stmtId, dto);
  }

  @ApiOperation({ summary: 'Bulk import statement lines into a bank statement' })
  @Post(':id/statements/:stmtId/import')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  importLines(
    @Param('stmtId') stmtId: string,
    @Body() lines: CreateBankStatementLineDto[],
  ) {
    return this.bankService.importStatementLines(stmtId, lines);
  }

  // ─── RECONCILIATION ──────────────────────────────────────
  @ApiOperation({ summary: 'Automatically match statement lines to journal lines' })
  @Post(':id/statements/:stmtId/auto-match')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  autoMatch(@Param('stmtId') stmtId: string) {
    return this.bankService.autoMatch(stmtId);
  }

  @ApiOperation({ summary: 'Manually match a statement line to a journal line' })
  @Patch(':id/statements/:stmtId/lines/:lineId/match')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  manualMatch(
    @Param('lineId') lineId: string,
    @Body('journalLineId') journalLineId: string,
  ) {
    return this.bankService.manualMatch(lineId, journalLineId);
  }

  @ApiOperation({ summary: 'Finalize a bank statement reconciliation' })
  @Post(':id/statements/:stmtId/finalize')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  finalize(@Param('stmtId') stmtId: string) {
    return this.bankService.finalizeStatement(stmtId);
  }
}
