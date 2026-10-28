/**
 * One-off backfill: posts a catch-up Cost of Goods Sold journal entry for
 * every already-APPROVED/PAID sales invoice that predates COGS posting
 * being added to InvoicesService.approve(). Safe to re-run — skips any
 * invoice that already has a COGS-<invoiceNo> journal entry, and skips any
 * invoice whose products have no costPrice set (nothing to post).
 *
 * Usage: npx ts-node scripts/backfill-cogs.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { InvoicesService } from '../src/modules/sales/services/invoices.service';
import { tenantContextStorage } from '../src/tenant-context';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const invoicesService = app.get(InvoicesService);

    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

    const grandTotal = {
      totalInvoices: 0,
      posted: 0,
      skippedAlreadyBackfilled: 0,
      skippedNoCostData: 0,
      totalCogsPosted: 0,
    };

    const tenantErrors: { tenant: string; error: string }[] = [];

    for (const tenant of tenants) {
      try {
        const summary = await tenantContextStorage.run({ tenantId: tenant.id }, () =>
          invoicesService.backfillCogs(),
        );

        console.log(`\nTenant: ${tenant.name} (${tenant.id})`);
        console.log(`  Invoices checked:        ${summary.totalInvoices}`);
        console.log(`  COGS posted:              ${summary.posted}`);
        console.log(`  Already backfilled:       ${summary.skippedAlreadyBackfilled}`);
        console.log(`  Skipped (no cost data):   ${summary.skippedNoCostData}`);
        console.log(`  Total COGS posted (KES):  ${summary.totalCogsPosted.toFixed(2)}`);

        grandTotal.totalInvoices += summary.totalInvoices;
        grandTotal.posted += summary.posted;
        grandTotal.skippedAlreadyBackfilled += summary.skippedAlreadyBackfilled;
        grandTotal.skippedNoCostData += summary.skippedNoCostData;
        grandTotal.totalCogsPosted += summary.totalCogsPosted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`\nTenant: ${tenant.name} (${tenant.id})`);
        console.log(`  FAILED: ${message}`);
        tenantErrors.push({ tenant: `${tenant.name} (${tenant.id})`, error: message });
      }
    }

    console.log('\n=== Grand total across all tenants ===');
    console.log(`  Invoices checked:        ${grandTotal.totalInvoices}`);
    console.log(`  COGS posted:              ${grandTotal.posted}`);
    console.log(`  Already backfilled:       ${grandTotal.skippedAlreadyBackfilled}`);
    console.log(`  Skipped (no cost data):   ${grandTotal.skippedNoCostData}`);
    console.log(`  Total COGS posted (KES):  ${grandTotal.totalCogsPosted.toFixed(2)}`);
    if (tenantErrors.length > 0) {
      console.log(`\n  ${tenantErrors.length} tenant(s) failed (likely missing chart of accounts):`);
      for (const { tenant, error } of tenantErrors) {
        console.log(`    - ${tenant}: ${error}`);
      }
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
