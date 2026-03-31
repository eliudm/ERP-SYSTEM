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
  // Seed a warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'default-warehouse' },
    update: {},
    create: {
      id: 'default-warehouse',
      name: 'Main Warehouse',
      location: 'Nairobi',
    },
  });

  // Seed products
  const products = [
    {
      code: 'PROD-001',
      name: 'Office Chair',
      unitPrice: 15000,
      taxRate: 0.16,
      stockQuantity: 50,
    },
    {
      code: 'PROD-002',
      name: 'Office Desk',
      unitPrice: 25000,
      taxRate: 0.16,
      stockQuantity: 30,
    },
    {
      code: 'PROD-003',
      name: 'Laptop Stand',
      unitPrice: 3500,
      taxRate: 0.16,
      stockQuantity: 100,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
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
