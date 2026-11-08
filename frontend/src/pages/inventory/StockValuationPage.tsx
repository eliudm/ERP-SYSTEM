import React, { useState, useMemo } from 'react';
import {
  Table, Card, Typography, Space, Input, Select, Tag,
  Statistic, Row, Col, Button, Tooltip,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, DownloadOutlined,
  InboxOutlined, DollarOutlined, ShoppingOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import { formatCurrency } from '../../utils/format';
import { exportStockValuationToExcel } from '../../utils/excel';
import type { Product, ProductCategory } from '../../types';
import { message } from 'antd';

const { Title } = Typography;
const { Search } = Input;

export const StockValuationPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-valuation-all'],
    queryFn: () => inventoryApi.getProducts(undefined, undefined, 10000),
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: inventoryApi.getCategories,
  });

  const rows = useMemo(() => {
    if (!products) return [];
    return products
      .filter((p) => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
        const matchCategory = !categoryFilter || p.categoryId === categoryFilter;
        return matchSearch && matchCategory;
      })
      .map((p) => {
        const qty = Number(p.stockQuantity);
        const cost = p.costPrice != null ? Number(p.costPrice) : 0;
        const retail = Number(p.unitPrice);
        return {
          ...p,
          qty,
          cost,
          retail,
          costValue: qty * cost,
          retailValue: qty * retail,
          isLow: qty <= Number(p.reorderLevel || 0),
        };
      });
  }, [products, search, categoryFilter]);

  const totals = useMemo(() => ({
    skus: rows.length,
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalCostValue: rows.reduce((s, r) => s + r.costValue, 0),
    totalRetailValue: rows.reduce((s, r) => s + r.retailValue, 0),
    lowStockCount: rows.filter((r) => r.isLow).length,
  }), [rows]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const valData = rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        stockQuantity: r.qty,
        unitPrice: r.retail,
        costPrice: r.cost,
        retailValue: r.retailValue,
        costValue: r.costValue,
      }));
      await exportStockValuationToExcel(valData, {
        totalCostValue: totals.totalCostValue,
        totalRetailValue: totals.totalRetailValue,
      });
    } catch {
      message.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: typeof rows[number]) => (
        <Space>
          <span>{v}</span>
          {record.isLow && (
            <Tooltip title={`Low stock — reorder level: ${Number(record.reorderLevel || 0)}`}>
              <WarningOutlined style={{ color: '#fa8c16' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      width: 130,
      render: (_: unknown, record: typeof rows[number]) =>
        record.category ? (
          <Tag
            color={record.category.color || 'blue'}
            style={{ color: record.category.color ? '#fff' : undefined }}
          >
            {record.category.icon ? `${record.category.icon} ` : ''}{record.category.name}
          </Tag>
        ) : (
          <Tag color="default">Uncategorized</Tag>
        ),
    },
    {
      title: 'Qty on Hand',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      sorter: (a: typeof rows[number], b: typeof rows[number]) => a.qty - b.qty,
      render: (v: number, record: typeof rows[number]) => (
        <span style={{ color: record.isLow ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
          {v.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Cost Price',
      dataIndex: 'cost',
      key: 'cost',
      align: 'right' as const,
      sorter: (a: typeof rows[number], b: typeof rows[number]) => a.cost - b.cost,
      render: (v: number) =>
        v > 0 ? formatCurrency(v) : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Selling Price',
      dataIndex: 'retail',
      key: 'retail',
      align: 'right' as const,
      sorter: (a: typeof rows[number], b: typeof rows[number]) => a.retail - b.retail,
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Stock Value (Cost)',
      dataIndex: 'costValue',
      key: 'costValue',
      align: 'right' as const,
      sorter: (a: typeof rows[number], b: typeof rows[number]) => a.costValue - b.costValue,
      render: (v: number, record: typeof rows[number]) =>
        record.cost > 0 ? (
          <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: 'Stock Value (Retail)',
      dataIndex: 'retailValue',
      key: 'retailValue',
      align: 'right' as const,
      sorter: (a: typeof rows[number], b: typeof rows[number]) => a.retailValue - b.retailValue,
      render: (v: number) => formatCurrency(v),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Stock Valuation</Title>
        <Button
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          Export to Excel
        </Button>
      </div>

      {/* Summary cards */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total SKUs"
              value={totals.skus}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Units in Stock"
              value={totals.totalQty}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Stock Value (Cost)"
              value={totals.totalCostValue}
              prefix={<DollarOutlined />}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Retail Value"
              value={totals.totalRetailValue}
              prefix={<BarChartOutlined />}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {totals.lowStockCount > 0 && (
        <Card
          size="small"
          style={{ background: '#fff7e6', border: '1px solid #ffd591' }}
        >
          <Space>
            <WarningOutlined style={{ color: '#fa8c16' }} />
            <span style={{ color: '#ad4e00' }}>
              <strong>{totals.lowStockCount}</strong> product{totals.lowStockCount > 1 ? 's are' : ' is'} at or below reorder level.
            </span>
          </Space>
        </Card>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="Search by name or code…"
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            onSearch={setSearch}
            onChange={(e) => !e.target.value && setSearch('')}
            allowClear
          />
          <Select
            placeholder="All categories"
            style={{ width: 180 }}
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              ...(categories || []).map((c: ProductCategory) => ({
                value: c.id,
                label: `${c.icon ? c.icon + ' ' : ''}${c.name}`,
              })),
            ]}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          size="small"
          rowClassName={(record) => record.isLow ? 'ant-table-row-low-stock' : ''}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={3}>
                  Total ({rows.length} products)
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  {totals.totalQty.toLocaleString()}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} />
                <Table.Summary.Cell index={6} align="right">
                  {formatCurrency(totals.totalCostValue)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  {formatCurrency(totals.totalRetailValue)}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </Space>
  );
};
