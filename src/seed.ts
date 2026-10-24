import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // seed.ts runs standalone (not through NestJS), so it never goes through
  // the tenant-scoping Prisma extension — tenantId has to be passed
  // explicitly on every tenant-scoped model below.
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default-company' },
    update: {},
    create: { name: 'Default Company', slug: 'default-company' },
  });

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'system' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'system',
      companyName: 'Nexora ERP',
      companyPin: 'P051234567X',
      companyAddress: 'Moi Avenue, Nairobi, Kenya',
      receiptSlogan:
        'Streamlined operations. Compliant receipts. Better business.',
      defaultCurrency: 'KES',
      timezone: 'Africa/Nairobi',
      defaultLanguage: 'en-KE',
      emailNotifications: true,
      autoApproveDrafts: false,
      showLowStockAlerts: true,
      posReceiptBranding: true,
    },
  });

  // Seed a warehouse
  await prisma.warehouse.upsert({
    where: { id: 'default-warehouse' },
    update: {},
    create: {
      id: 'default-warehouse',
      tenantId: tenant.id,
      name: 'Main Warehouse',
      location: 'Nairobi',
    },
  });

  const categories = await Promise.all([
    prisma.productCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Furniture' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Furniture' },
    }),
    prisma.productCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Accessories' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Accessories' },
    }),
  ]);

  const furnitureCategory = categories.find(
    (category) => category.name === 'Furniture',
  );
  const accessoriesCategory = categories.find(
    (category) => category.name === 'Accessories',
  );

  // Seed products
  const products = [
    {
      code: 'PROD-001',
      name: 'Office Chair',
      categoryId: furnitureCategory?.id,
      unitPrice: 15000,
      taxRate: 0.16,
      stockQuantity: 50,
    },
    {
      code: 'PROD-002',
      name: 'Office Desk',
      categoryId: furnitureCategory?.id,
      unitPrice: 25000,
      taxRate: 0.16,
      stockQuantity: 30,
    },
    {
      code: 'PROD-003',
      name: 'Laptop Stand',
      categoryId: accessoriesCategory?.id,
      unitPrice: 3500,
      taxRate: 0.16,
      stockQuantity: 100,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: product.code } },
      update: {},
      create: { ...product, tenantId: tenant.id },
    });
  }

  console.log('✅ Seed complete');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
