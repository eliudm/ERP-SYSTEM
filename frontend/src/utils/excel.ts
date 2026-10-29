import type ExcelJS from 'exceljs';

// exceljs's browser bundle is large (~1MB) — loaded on demand only when a
// user actually imports/exports something, instead of bloating every page
// load for everyone who never touches these features.
async function loadExcelJS(): Promise<typeof ExcelJS> {
  const mod = await import('exceljs');
  return mod.default;
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle' };
}

// ─── STOCK IMPORT TEMPLATE ──────────────────────────────────
export async function downloadStockImportTemplate() {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock Import');

  sheet.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Warehouse', key: 'warehouse', width: 20 },
    { header: 'Unit Cost', key: 'unitCost', width: 12 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  styleHeaderRow(sheet.getRow(1));

  sheet.addRow({
    code: 'SKU-001',
    quantity: 50,
    warehouse: 'Main Warehouse',
    unitCost: 120.5,
    notes: 'Example row — delete before importing',
  });

  await downloadWorkbook(workbook, 'stock-import-template.xlsx');
}

// ─── PARSE AN UPLOADED STOCK IMPORT FILE ────────────────────
export interface ParsedStockImportRow {
  productCode: string;
  quantity: number;
  warehouseName?: string;
  unitCost?: number;
  notes?: string;
}

const HEADER_KEY_MAP: Record<string, keyof ParsedStockImportRow> = {
  code: 'productCode',
  productcode: 'productCode',
  quantity: 'quantity',
  qty: 'quantity',
  warehouse: 'warehouseName',
  unitcost: 'unitCost',
  'unit cost': 'unitCost',
  notes: 'notes',
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export async function parseStockImportFile(file: File): Promise<ParsedStockImportRow[]> {
  const ExcelJS = await loadExcelJS();
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const columnKeys: (keyof ParsedStockImportRow | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = HEADER_KEY_MAP[normalizeHeader(cell.value)] ?? null;
    columnKeys[colNumber] = key;
  });

  const rows: ParsedStockImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return; // header
    }

    const parsed: Partial<ParsedStockImportRow> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = columnKeys[colNumber];
      if (!key || cell.value === null || cell.value === undefined || cell.value === '') {
        return;
      }
      if (key === 'quantity' || key === 'unitCost') {
        (parsed as any)[key] = Number(cell.value);
      } else {
        (parsed as any)[key] = String(cell.value).trim();
      }
    });

    if (parsed.productCode) {
      rows.push({
        productCode: parsed.productCode,
        quantity: parsed.quantity ?? 0,
        warehouseName: parsed.warehouseName,
        unitCost: parsed.unitCost,
        notes: parsed.notes,
      });
    }
  });

  return rows;
}

// ─── EXPORT PRODUCTS / STOCK LIST ───────────────────────────
export interface ExportableProduct {
  code: string;
  name: string;
  categoryName?: string;
  unitPrice: number;
  taxRate: number;
  costPrice?: number | null;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
}

export async function exportStockListToExcel(products: ExportableProduct[]) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock List');

  sheet.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Unit Price', key: 'unitPrice', width: 14 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Cost Price', key: 'costPrice', width: 14 },
    { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
    { header: 'Reorder Level', key: 'reorderLevel', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  styleHeaderRow(sheet.getRow(1));

  products.forEach((p) => {
    sheet.addRow({
      code: p.code,
      name: p.name,
      category: p.categoryName ?? '',
      unitPrice: p.unitPrice,
      taxRate: p.taxRate,
      costPrice: p.costPrice ?? '',
      stockQuantity: p.stockQuantity,
      reorderLevel: p.reorderLevel,
      status: p.isActive ? 'Active' : 'Inactive',
    });
  });

  await downloadWorkbook(workbook, `stock-list-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ─── EXPORT STOCK VALUATION ──────────────────────────────────
export interface StockValuationItem {
  code: string;
  name: string;
  stockQuantity: number;
  costPrice: number;
  costValue: number;
  unitPrice: number;
  retailValue: number;
}

export async function exportStockValuationToExcel(
  items: StockValuationItem[],
  totals: { totalCostValue: number; totalRetailValue: number },
) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock Value');

  sheet.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
    { header: 'Cost Price', key: 'costPrice', width: 14 },
    { header: 'Cost Value', key: 'costValue', width: 16 },
    { header: 'Unit Price', key: 'unitPrice', width: 14 },
    { header: 'Retail Value', key: 'retailValue', width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));

  items.forEach((item) => sheet.addRow(item));

  const totalRow = sheet.addRow({
    code: '',
    name: 'TOTAL',
    stockQuantity: '',
    costPrice: '',
    costValue: totals.totalCostValue,
    unitPrice: '',
    retailValue: totals.totalRetailValue,
  });
  totalRow.font = { bold: true };

  await downloadWorkbook(workbook, `stock-value-${new Date().toISOString().split('T')[0]}.xlsx`);
}
