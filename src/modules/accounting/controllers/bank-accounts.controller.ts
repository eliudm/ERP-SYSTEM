import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
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

@UseGuards(JwtAuthGuard)
@Controller('accounting/bank-accounts')
export class BankAccountsController {
  constructor(private bankService: BankReconciliationService) {}

  // ─── BANK ACCOUNTS ───────────────────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankService.createBankAccount(dto);
  }

  @Get()
  findAll() {
    return this.bankService.findAllBankAccounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bankService.findOneBankAccount(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.bankService.deactivateBankAccount(id);
  }

  // ─── STATEMENTS ──────────────────────────────────────────
  @Post(':id/statements')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createStatement(
    @Param('id') id: string,
    @Body() dto: CreateBankStatementDto,
  ) {
    return this.bankService.createStatement(id, dto);
  }

  @Get(':id/statements')
  findStatements(@Param('id') id: string) {
    return this.bankService.findStatements(id);
  }

  @Get(':id/statements/:stmtId')
  findOneStatement(@Param('stmtId') stmtId: string) {
    return this.bankService.findOneStatement(stmtId);
  }

  // ─── STATEMENT LINES ─────────────────────────────────────
  @Post(':id/statements/:stmtId/lines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  addLine(
    @Param('stmtId') stmtId: string,
    @Body() dto: CreateBankStatementLineDto,
  ) {
    return this.bankService.addStatementLine(stmtId, dto);
  }

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
  @Post(':id/statements/:stmtId/auto-match')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  autoMatch(@Param('stmtId') stmtId: string) {
    return this.bankService.autoMatch(stmtId);
  }

  @Patch(':id/statements/:stmtId/lines/:lineId/match')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  manualMatch(
    @Param('lineId') lineId: string,
    @Body('journalLineId') journalLineId: string,
  ) {
    return this.bankService.manualMatch(lineId, journalLineId);
  }

  @Post(':id/statements/:stmtId/finalize')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  finalize(@Param('stmtId') stmtId: string) {
    return this.bankService.finalizeStatement(stmtId);
  }
}
