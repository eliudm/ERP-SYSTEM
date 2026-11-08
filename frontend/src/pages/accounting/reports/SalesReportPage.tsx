import React, { useState } from 'react';
import {
  Card, Typography, Space, Table, DatePicker, Button,
  Tabs, Statistic, Row, Col, Tag, Tooltip, Progress,
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate } from '../../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PM_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank', CREDIT: 'Credit',
};
const PM_COLORS: Record<string, string> = {
  CASH: 'green', CARD: 'purple', MOBILE_MONEY: 'blue',
  BANK_TRANSFER: 'cyan', CREDIT: 'orange',
};

const margin = (v: number) => (
  <Tooltip title={`${v.toFixed(1)}%`}>
    <Progress
      percent={Math.min(100, Math.max(0, v))}
      size="small"
      strokeColor={v >= 30 ? '#52c41a' : v >= 15 ? '#faad14' : '#ff4d4f'}
      format={() => `${v.toFixed(1)}%`}
    />
  </Tooltip>
);

const currency = (v: number) =>
  v > 0 ? formatCurrency(v) : <Text type="secondary">—</Text>;

// ── Cashier Summary Tab ─────────────────────────────────────────
type CashierRow = {
  cashierName: string; cash: number; card: number; mobileMoney: number;
  bankTransfer: number; credit: number; total: number;
  grossProfit: number; profitMargin: number;
};

const exportCashierCsv = (rows: CashierRow[]) => {
  const hdr = 'Cashier,Cash,M-Pesa,Card,Bank Transfer,Credit,Total,Gross Profit,Margin %';
  const lines = rows.map((r) =>
    [r.cashierName, r.cash, r.mobileMoney, r.card, r.bankTransfer,
      r.credit, r.total, r.grossProfit, r.profitMargin.toFixed(1)].join(','),
  );
  const blob = new Blob([[hdr, ...lines].join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'cashier-summary.csv',
  });
  a.click(); URL.revokeObjectURL(a.href);
};

const cashierColumns = [
  { title: 'Cashier', dataIndex: 'cashierName', key: 'cashier', width: 160,
    render: (v: string, r: any) => r.key === '__totals__'
      ? <Text strong style={{ color: '#262626' }}>{v}</Text>
      : <Text strong>{v}</Text> },
  { title: <span style={{ color: '#52c41a' }}>💵 Cash</span>, dataIndex: 'cash', align: 'right' as const,
    render: (v: number) => currency(v) },
  { title: <span style={{ color: '#1677ff' }}>📱 M-Pesa</span>, dataIndex: 'mobileMoney', align: 'right' as const,
    render: (v: number) => currency(v) },
  { title: <span style={{ color: '#722ed1' }}>💳 Card</span>, dataIndex: 'card', align: 'right' as const,
    render: (v: number) => currency(v) },
  { title: <span style={{ color: '#13c2c2' }}>🏦 Bank</span>, dataIndex: 'bankTransfer', align: 'right' as const,
    render: (v: number) => currency(v) },
  { title: <span style={{ color: '#fa8c16' }}>📑 Credit</span>, dataIndex: 'credit', align: 'right' as const,
    render: (v: number) => currency(v) },
  { title: 'Total Sales', dataIndex: 'total', align: 'right' as const,
    render: (v: number) => <Text strong>{formatCurrency(v)}</Text> },
  { title: 'Gross Profit', dataIndex: 'grossProfit', align: 'right' as const,
    render: (v: number) => <Text strong style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatCurrency(v)}</Text> },
  { title: 'Margin', dataIndex: 'profitMargin', width: 150,
    render: (v: number) => margin(v) },
];

// ── Full Sales Tab ───────────────────────────────────────────────
type FullRow = {
  date: string; invoiceNo: string; cashier: string; customer: string;
  paymentMethod: string; productCode: string; productName: string;
  quantity: number; unitPrice: number; costPrice: number;
  lineTotal: number; grossProfit: number; profitMargin: number;
};

const exportFullCsv = (rows: FullRow[]) => {
  const hdr = 'Date,Invoice,Cashier,Customer,Payment,Product Code,Product,Qty,Unit Price,Cost Price,Line Total,Gross Profit,Margin %';
  const lines = rows.map((r) =>
    [r.date, r.invoiceNo, r.cashier, r.customer, r.paymentMethod, r.productCode,
      `"${r.productName}"`, r.quantity, r.unitPrice, r.costPrice,
      r.lineTotal, r.grossProfit, r.profitMargin.toFixed(1)].join(','),
  );
  const blob = new Blob([[hdr, ...lines].join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'full-sales-report.csv',
  });
  a.click(); URL.revokeObjectURL(a.href);
};

const fullColumns = [
  { title: 'Date', dataIndex: 'date', key: 'date', width: 100, fixed: 'left' as const,
    render: (v: string) => <Text style={{ fontSize: 12 }}>{formatDate(v)}</Text> },
  { title: 'Invoice', dataIndex: 'invoiceNo', width: 110,
    render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
  { title: 'Cashier', dataIndex: 'cashier', width: 110,
    render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Customer', dataIndex: 'customer', width: 130,
    render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Method', dataIndex: 'paymentMethod', width: 90,
    render: (v: string) => <Tag color={PM_COLORS[v] ?? 'default'} style={{ fontSize: 11 }}>{PM_LABELS[v] ?? v}</Tag> },
  { title: 'Product', dataIndex: 'productName', width: 180,
    render: (v: string, r: FullRow) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{v}</div>
        {r.productCode && <div style={{ fontSize: 10, color: '#8c8c8c' }}>{r.productCode}</div>}
      </div>
    ) },
  { title: 'Qty', dataIndex: 'quantity', align: 'right' as const, width: 60,
    render: (v: number) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Unit Price', dataIndex: 'unitPrice', align: 'right' as const, width: 100,
    render: (v: number) => <Text style={{ fontSize: 12 }}>{formatCurrency(v)}</Text> },
  { title: 'Cost Price', dataIndex: 'costPrice', align: 'right' as const, width: 100,
    render: (v: number) => v > 0 ? <Text style={{ fontSize: 12 }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text> },
  { title: 'Line Total', dataIndex: 'lineTotal', align: 'right' as const, width: 110, fixed: 'right' as const,
    render: (v: number) => <Text strong style={{ fontSize: 12 }}>{formatCurrency(v)}</Text> },
  { title: 'Profit', dataIndex: 'grossProfit', align: 'right' as const, width: 100, fixed: 'right' as const,
    render: (v: number) => <Text strong style={{ fontSize: 12, color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatCurrency(v)}</Text> },
  { title: 'Margin', dataIndex: 'profitMargin', width: 120, fixed: 'right' as const,
    render: (v: number) => margin(v) },
];

// ── Page ─────────────────────────────────────────────────────────
export const SalesReportPage: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);
  const [activeTab, setActiveTab] = useState<'cashier' | 'full'>('cashier');

  const cashierQ = useQuery({
    queryKey: ['cashier-summary', dates],
    queryFn: () => accountingApi.getCashierSummary(dates[0], dates[1]),
    enabled: activeTab === 'cashier',
  });

  const fullQ = useQuery({
    queryKey: ['full-sales', dates],
    queryFn: () => accountingApi.getFullSalesReport(dates[0], dates[1]),
    enabled: activeTab === 'full',
  });

  const cashierRows = cashierQ.data?.rows ?? [];
  const cashierTotals = cashierQ.data?.totals;
  const fullRows = fullQ.data?.rows ?? [];
  const fullTotals = fullQ.data?.totals;

  const cashierTableData = [
    ...cashierRows.map((r) => ({ ...r, key: r.cashierName })),
    ...(cashierTotals && cashierRows.length > 0 ? [{
      key: '__totals__', cashierName: 'TOTALS',
      cash: cashierTotals.cash, card: cashierTotals.card,
      mobileMoney: cashierTotals.mobileMoney, bankTransfer: cashierTotals.bankTransfer,
      credit: cashierTotals.credit, total: cashierTotals.total,
      grossProfit: cashierTotals.grossProfit, profitMargin: cashierTotals.profitMargin,
    }] : []),
  ];

  const isLoading = activeTab === 'cashier' ? cashierQ.isLoading : fullQ.isLoading;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Sales Reports</Title>
        <Space wrap>
          <RangePicker
            defaultValue={[dayjs().startOf('month'), dayjs()]}
            onChange={(_, strings) => {
              if (strings[0] && strings[1]) setDates([strings[0], strings[1]]);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />}
            loading={isLoading}
            onClick={() => activeTab === 'cashier' ? cashierQ.refetch() : fullQ.refetch()}>
            Run
          </Button>
          {activeTab === 'cashier' && cashierRows.length > 0 && (
            <Button icon={<DownloadOutlined />} onClick={() => exportCashierCsv(cashierRows)}>
              Export CSV
            </Button>
          )}
          {activeTab === 'full' && fullRows.length > 0 && (
            <Button icon={<DownloadOutlined />} onClick={() => exportFullCsv(fullRows)}>
              Export CSV
            </Button>
          )}
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        items={[
          {
            key: 'cashier',
            label: '👤 Cashier Summary',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Summary cards */}
                {cashierTotals && (
                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #1677ff' }}>
                        <Statistic title="Total Revenue" value={cashierTotals.total}
                          formatter={(v) => formatCurrency(Number(v))}
                          valueStyle={{ color: '#1677ff', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
                        <Statistic title="Gross Profit" value={cashierTotals.grossProfit}
                          formatter={(v) => formatCurrency(Number(v))}
                          valueStyle={{ color: '#52c41a', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #faad14' }}>
                        <Statistic title="Avg Margin" value={cashierTotals.profitMargin}
                          precision={1} suffix="%"
                          valueStyle={{ color: cashierTotals.profitMargin >= 20 ? '#52c41a' : '#faad14', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #722ed1' }}>
                        <Statistic title="Cashiers" value={cashierRows.length}
                          valueStyle={{ fontSize: 15 }} />
                      </Card>
                    </Col>
                  </Row>
                )}
                <Card>
                  <Table
                    columns={cashierColumns}
                    dataSource={cashierTableData}
                    loading={cashierQ.isLoading}
                    pagination={false}
                    size="small"
                    scroll={{ x: 900 }}
                    rowClassName={(r) => r.key === '__totals__' ? 'totals-row' : ''}
                    locale={{ emptyText: 'No sales in selected period' }}
                  />
                  <style>{`.totals-row td { background: #f6f6f6 !important; font-weight: 700; border-top: 2px solid #d9d9d9; }`}</style>
                </Card>
              </Space>
            ),
          },
          {
            key: 'full',
            label: '📋 Full Sales Report',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Summary cards */}
                {fullTotals && (
                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #1677ff' }}>
                        <Statistic title="Revenue" value={fullTotals.revenue}
                          formatter={(v) => formatCurrency(Number(v))}
                          valueStyle={{ color: '#1677ff', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #ff4d4f' }}>
                        <Statistic title="Cost of Goods" value={fullTotals.cogs}
                          formatter={(v) => formatCurrency(Number(v))}
                          valueStyle={{ color: '#ff4d4f', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
                        <Statistic title="Gross Profit" value={fullTotals.grossProfit}
                          formatter={(v) => formatCurrency(Number(v))}
                          valueStyle={{ color: '#52c41a', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #faad14' }}>
                        <Statistic title="Avg Margin" value={fullTotals.profitMargin}
                          precision={1} suffix="%"
                          valueStyle={{ color: fullTotals.profitMargin >= 20 ? '#52c41a' : '#faad14', fontSize: 15 }} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                      <Card size="small" style={{ borderTop: '3px solid #722ed1' }}>
                        <Statistic title="Line Items" value={fullRows.length}
                          valueStyle={{ fontSize: 15 }} />
                      </Card>
                    </Col>
                  </Row>
                )}
                <Card>
                  <Table
                    columns={fullColumns}
                    dataSource={fullRows.map((r, i) => ({ ...r, key: i }))}
                    loading={fullQ.isLoading}
                    size="small"
                    scroll={{ x: 1400 }}
                    pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} items` }}
                    locale={{ emptyText: 'No sales in selected period' }}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
};
