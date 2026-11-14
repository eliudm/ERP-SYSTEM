import React, { useMemo, useState } from 'react';
import {
  Card, Col, Row, Space, Typography, Statistic,
  Table, Tag, Progress, Segmented, Button, Menu, Empty,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  LeftOutlined, RightOutlined,
  AppstoreOutlined, LineChartOutlined,
  DatabaseOutlined, ShoppingOutlined,
  DollarOutlined, TeamOutlined,
  FileTextOutlined, BarChartOutlined,
  FundOutlined, AuditOutlined,
  ShopOutlined, PieChartOutlined,
  TruckOutlined, ReconciliationOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  Legend, ResponsiveContainer, Treemap, Cell,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { analyticsApi } from '../../api/analytics.api';
import { salesApi } from '../../api/sales.api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';

const { Text } = Typography;

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#a0d911'];

// ─── Period helpers ───────────────────────────────────────────────────────────
type PeriodPreset = 'last30' | 'last90' | 'thisMonth' | 'thisYear';

const PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'Last 90 Days', value: 'last90' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'This Year', value: 'thisYear' },
];

function computePeriod(preset: PeriodPreset, offset: number) {
  const today = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;
  switch (preset) {
    case 'last30':
      end = today.subtract(offset * 30, 'day');
      start = end.subtract(29, 'day');
      break;
    case 'last90':
      end = today.subtract(offset * 90, 'day');
      start = end.subtract(89, 'day');
      break;
    case 'thisMonth':
      end = today.subtract(offset, 'month').endOf('month');
      start = today.subtract(offset, 'month').startOf('month');
      break;
    default:
      end = today.subtract(offset, 'year').endOf('year');
      start = today.subtract(offset, 'year').startOf('year');
  }
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

function periodLabel(preset: PeriodPreset, offset: number) {
  if (offset === 0) return PRESETS.find(p => p.value === preset)?.label ?? '';
  const { start, end } = computePeriod(preset, offset);
  return `${dayjs(start).format('D MMM')} – ${dayjs(end).format('D MMM YYYY')}`;
}

// ─── Shared components ────────────────────────────────────────────────────────
const SectionCard: React.FC<{ title?: string; extra?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, extra, children, style }) => (
  <Card
    variant="borderless"
    title={title ? <Text strong style={{ fontSize: 14, color: '#009688' }}>{title}</Text> : undefined}
    extra={extra}
    style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 16, ...style }}
  >
    {children}
  </Card>
);

const Delta: React.FC<{ pct: number | null; style?: React.CSSProperties }> = ({ pct, style }) => {
  if (pct === null || pct === undefined) return <Text type="secondary">—</Text>;
  const up = pct >= 0;
  return (
    <span style={{ color: up ? '#52c41a' : '#ff4d4f', fontWeight: 700, ...style }}>
      {up ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
      {' '}{Math.abs(pct).toFixed(0)}%
    </span>
  );
};

const KpiTile: React.FC<{ label: string; value: React.ReactNode; pct?: number | null; color?: string }> = ({ label, value, pct, color = '#1677ff' }) => (
  <Card variant="borderless" style={{ borderRadius: 14, borderTop: `4px solid ${color}`, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
    <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{value}</div>
    {pct !== undefined && <Delta pct={pct ?? null} />}
  </Card>
);

const TreemapBlock = (props: any) => {
  const { x, y, width, height, name, fill } = props;
  if (width < 40 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 50 && height > 28 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={Math.min(13, width / 7)} fontWeight={600}>
          {name}
        </text>
      )}
    </g>
  );
};

function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

// ─── ACCOUNTING (Finance Overview) ───────────────────────────────────────────
const AccountingSection: React.FC<{ year: number }> = ({ year }) => {
  const ys = `${year}-01-01`;
  const ye = `${year}-12-31`;
  const pys = `${year - 1}-01-01`;
  const pye = `${year - 1}-12-31`;

  const { data: monthly } = useQuery({
    queryKey: ['monthly-sales', year],
    queryFn: () => salesApi.getMonthlySales(year),
  });
  const { data: prevMonthly } = useQuery({
    queryKey: ['monthly-sales', year - 1],
    queryFn: () => salesApi.getMonthlySales(year - 1),
  });
  const { data: profitCur } = useQuery({
    queryKey: ['profit-trend', ys, ye],
    queryFn: () => analyticsApi.getProfitTrend(ys, ye, 'month'),
  });
  const { data: profitPrev } = useQuery({
    queryKey: ['profit-trend', pys, pye],
    queryFn: () => analyticsApi.getProfitTrend(pys, pye, 'month'),
  });

  const months = monthly?.months || [];
  const chartData = months.map(m => ({
    month: dayjs(m.month).format('MMM YYYY'),
    Revenue: m.revenue,
    Collected: m.paid,
  }));

  const curRevenue = profitCur?.totals.revenue ?? 0;
  const prevRevenue = profitPrev?.totals.revenue ?? 0;
  const curExpense = profitCur?.totals.expense ?? 0;
  const prevExpense = profitPrev?.totals.expense ?? 0;
  const curProfit = profitCur?.totals.profit ?? 0;
  const prevProfit = profitPrev?.totals.profit ?? 0;

  const curCashReceived = monthly?.months.reduce((s, m) => s + m.paid, 0) ?? 0;
  const prevCashReceived = prevMonthly?.months.reduce((s, m) => s + m.paid, 0) ?? 0;

  const cashRows = [
    { key: 'rcv', label: 'Cash received', cur: curCashReceived, prev: prevCashReceived },
    { key: 'spent', label: 'Cash spent', cur: -curExpense, prev: -prevExpense },
    { key: 'surplus', label: 'Cash surplus', cur: curCashReceived - curExpense, prev: prevCashReceived - prevExpense, bold: true },
  ];

  const profitRows = [
    { key: 'inc', label: 'Income', cur: curRevenue, prev: prevRevenue },
    { key: 'exp', label: 'Expenses', cur: -curExpense, prev: -prevExpense },
    { key: 'net', label: 'Net profit', cur: curProfit, prev: prevProfit, bold: true },
  ];

  const tableColumns = [
    { title: '', dataIndex: 'label', key: 'label', render: (v: string, r: any) => <Text strong={r.bold}>{v}</Text> },
    {
      title: String(year), dataIndex: 'cur', key: 'cur', align: 'right' as const,
      render: (v: number, r: any) => <Text strong={r.bold} style={{ color: v < 0 ? '#ff4d4f' : undefined }}>{formatCurrency(Math.abs(v))}{v < 0 ? ' (-)' : ''}</Text>,
    },
    {
      title: String(year - 1), dataIndex: 'prev', key: 'prev', align: 'right' as const,
      render: (v: number) => <Text type="secondary">{formatCurrency(Math.abs(v))}{v < 0 ? ' (-)' : ''}</Text>,
    },
    {
      title: 'Δ', key: 'delta', align: 'right' as const,
      render: (_: any, r: any) => <Delta pct={pct(r.cur, r.prev)} />,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      {/* Area chart */}
      <SectionCard>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1677ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1677ff" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} width={52} />
            <RechartsTip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Area type="monotone" dataKey="Revenue" stroke="#1677ff" fill="url(#gRev)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Collected" stroke="#52c41a" fill="url(#gCol)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Two comparison tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Cash">
            <Table columns={tableColumns} dataSource={cashRows} rowKey="key" pagination={false} size="small" />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Profitability">
            <Table columns={tableColumns} dataSource={profitRows} rowKey="key" pagination={false} size="small" />
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
};

// ─── INVOICING ────────────────────────────────────────────────────────────────
const InvoicingSection: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const { data: allInv } = useQuery({ queryKey: ['invoices', 1, 50], queryFn: () => salesApi.getInvoices(1, 50) });
  const { data: summary } = useQuery({
    queryKey: ['sales-summary', startDate, endDate],
    queryFn: () => salesApi.getSalesSummary(startDate, endDate),
  });

  const invoices = allInv?.data || [];
  const statusCount: Record<string, number> = {};
  invoices.forEach(inv => { statusCount[inv.status] = (statusCount[inv.status] || 0) + 1; });

  const statusBarData = Object.entries(statusCount).map(([status, count]) => ({ status, count }));

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoiceNo', key: 'inv' },
    { title: 'Customer', dataIndex: ['customer', 'name'], key: 'cust', render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Date', dataIndex: 'invoiceDate', key: 'date', render: (v: string) => formatDate(v) },
    { title: 'Amount', dataIndex: 'total', key: 'amt', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        {['DRAFT', 'APPROVED', 'PAID', 'VOID'].map((s, i) => (
          <Col key={s} xs={12} sm={6}>
            <KpiTile label={s} value={statusCount[s] ?? 0} color={COLORS[i]} />
          </Col>
        ))}
      </Row>
      <SectionCard title="Invoice Status Breakdown">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusBarData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <RechartsTip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {statusBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Recent Invoices">
        <Table columns={columns} dataSource={invoices.slice(0, 15)} rowKey="id" pagination={false} size="small" />
      </SectionCard>
    </Space>
  );
};

// ─── BENCHMARK ────────────────────────────────────────────────────────────────
const BenchmarkSection: React.FC<{ year: number }> = ({ year }) => {
  const { data: cur } = useQuery({
    queryKey: ['monthly-sales', year], queryFn: () => salesApi.getMonthlySales(year),
  });
  const { data: prev } = useQuery({
    queryKey: ['monthly-sales', year - 1], queryFn: () => salesApi.getMonthlySales(year - 1),
  });
  const { data: prev2 } = useQuery({
    queryKey: ['monthly-sales', year - 2], queryFn: () => salesApi.getMonthlySales(year - 2),
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = months.map((m, i) => ({
    month: m,
    [String(year)]: cur?.months[i]?.revenue ?? 0,
    [String(year - 1)]: prev?.months[i]?.revenue ?? 0,
    [String(year - 2)]: prev2?.months[i]?.revenue ?? 0,
  }));

  const totals = [
    { year, total: cur?.months.reduce((s, m) => s + m.revenue, 0) ?? 0 },
    { year: year - 1, total: prev?.months.reduce((s, m) => s + m.revenue, 0) ?? 0 },
    { year: year - 2, total: prev2?.months.reduce((s, m) => s + m.revenue, 0) ?? 0 },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        {totals.map((t, i) => (
          <Col key={t.year} xs={24} sm={8}>
            <KpiTile
              label={`Revenue ${t.year}`}
              value={formatCurrency(t.total)}
              pct={i > 0 ? pct(totals[i - 1].total, t.total) : undefined}
              color={COLORS[i]}
            />
          </Col>
        ))}
      </Row>
      <SectionCard title={`Monthly Revenue: ${year - 2} vs ${year - 1} vs ${year}`}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} width={52} />
            <RechartsTip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey={String(year - 2)} stroke={COLORS[2]} strokeWidth={2} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey={String(year - 1)} stroke={COLORS[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={String(year)} stroke={COLORS[0]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </Space>
  );
};

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
const ExpensesSection: React.FC<{ startDate: string; endDate: string; granularity: 'day' | 'month' }> = ({ startDate, endDate, granularity }) => {
  const { data: trend } = useQuery({
    queryKey: ['expense-trend', startDate, endDate, granularity],
    queryFn: () => analyticsApi.getExpenseTrend(startDate, endDate, granularity),
  });
  const { data: profit } = useQuery({
    queryKey: ['profit-trend', startDate, endDate, granularity],
    queryFn: () => analyticsApi.getProfitTrend(startDate, endDate, granularity),
  });

  const expData = trend?.data || [];
  const profData = profit?.data || [];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <KpiTile label="Total Expenses" value={formatCurrency(trend?.total ?? 0)} color="#ff4d4f" />
        </Col>
        <Col xs={24} sm={8}>
          <KpiTile label="Total Revenue" value={formatCurrency(profit?.totals.revenue ?? 0)} color="#52c41a" />
        </Col>
        <Col xs={24} sm={8}>
          <KpiTile label="Net Profit" value={formatCurrency(profit?.totals.profit ?? 0)} color="#1677ff" />
        </Col>
      </Row>

      <SectionCard title="Expense Trend">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={expData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} width={52} />
            <RechartsTip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="amount" name="Expenses" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Revenue vs Expenses">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={profData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} width={52} />
            <RechartsTip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#52c41a" strokeWidth={2} dot={false} name="Revenue" />
            <Line type="monotone" dataKey="expense" stroke="#ff4d4f" strokeWidth={2} dot={false} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke="#1677ff" strokeWidth={2} dot={false} name="Profit" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </Space>
  );
};

// ─── SALES ────────────────────────────────────────────────────────────────────
const SalesSection: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const { data: topProducts } = useQuery({
    queryKey: ['top-products', startDate, endDate],
    queryFn: () => analyticsApi.getTopProducts(startDate, endDate, 10),
  });
  const { data: topCustomers } = useQuery({
    queryKey: ['top-customers', startDate, endDate],
    queryFn: () => analyticsApi.getTopCustomers(startDate, endDate, 10),
  });
  const { data: salesReps } = useQuery({
    queryKey: ['sales-reps', startDate, endDate],
    queryFn: () => analyticsApi.getSalesRepLeaderboard(startDate, endDate),
  });
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-method', startDate, endDate],
    queryFn: () => analyticsApi.getSalesByPaymentMethod(startDate, endDate),
  });
  const { data: topQuotes } = useQuery({
    queryKey: ['quotes-top'], queryFn: () => salesApi.getQuotes(1, 8),
  });
  const { data: topOrders } = useQuery({
    queryKey: ['invoices-paid-top'], queryFn: () => salesApi.getInvoices(1, 8, 'PAID'),
  });

  const quoteColumns = [
    { title: 'Customer', dataIndex: ['customer', 'name'], key: 'cust', render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Quote #', dataIndex: 'quoteNumber', key: 'q' },
    { title: 'Amount', dataIndex: 'total', key: 'amt', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Status', dataIndex: 'status', key: 'st', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
  ];
  const orderColumns = [
    { title: 'Customer', dataIndex: ['customer', 'name'], key: 'cust', render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Invoice #', dataIndex: 'invoiceNo', key: 'inv' },
    { title: 'Revenue', dataIndex: 'total', key: 'rev', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Date', dataIndex: 'invoiceDate', key: 'dt', render: (v: string) => formatDate(v) },
  ];
  const productColumns = [
    { title: 'Product', dataIndex: 'name', key: 'n', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Units', dataIndex: 'quantitySold', key: 'u', align: 'right' as const, render: (v: number) => v.toFixed(0) },
    { title: 'Revenue', dataIndex: 'revenue', key: 'r', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];
  const customerColumns = [
    { title: 'Customer', dataIndex: 'name', key: 'n', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Orders', dataIndex: 'invoiceCount', key: 'o', align: 'right' as const },
    { title: 'Revenue', dataIndex: 'revenue', key: 'r', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];
  const repColumns = [
    { title: 'Salesperson', dataIndex: 'name', key: 'n', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Orders', dataIndex: 'count', key: 'c', align: 'right' as const },
    { title: 'Revenue', dataIndex: 'revenue', key: 'r', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];

  const pmData = paymentMethods?.data || [];
  const pmTotal = paymentMethods?.total || 1;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Top Quotations">
            <Table columns={quoteColumns} dataSource={topQuotes?.data || []} rowKey="id" pagination={false} size="small" />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Top Sales Orders">
            <Table columns={orderColumns} dataSource={topOrders?.data || []} rowKey="id" pagination={false} size="small" />
          </SectionCard>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Top Products">
            <Table columns={productColumns} dataSource={topProducts?.data || []} rowKey="productId" pagination={false} size="small" />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Top Customers">
            <Table columns={customerColumns} dataSource={topCustomers?.data || []} rowKey="customerId" pagination={false} size="small" />
          </SectionCard>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Top Salespeople">
            <Table columns={repColumns} dataSource={salesReps?.data || []} rowKey="userId" pagination={false} size="small" />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Sales by Payment Method">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {pmData.map((pm, i) => (
                <div key={pm.paymentMethod}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{pm.paymentMethod}</Text>
                    <Text strong>{formatCurrency(pm.amount)}</Text>
                  </div>
                  <Progress percent={Math.round((pm.amount / pmTotal) * 100)} strokeColor={COLORS[i % COLORS.length]} showInfo={false} size="small" />
                </div>
              ))}
              {pmData.length === 0 && <Text type="secondary">No payment data</Text>}
            </Space>
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
};

// ─── PRODUCT ──────────────────────────────────────────────────────────────────
const ProductSection: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const { data: topProducts } = useQuery({
    queryKey: ['top-products', startDate, endDate],
    queryFn: () => analyticsApi.getTopProducts(startDate, endDate, 20),
  });
  const { data: topCategories } = useQuery({
    queryKey: ['top-categories', startDate, endDate],
    queryFn: () => analyticsApi.getTopCategories(startDate, endDate, 10),
  });

  const products = topProducts?.data || [];
  const categories = topCategories?.data || [];
  const top10Rev = products.slice(0, 10);
  const top10Units = [...products].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10);
  const treemapData = categories.map((c, i) => ({ name: c.name, size: c.revenue, fill: COLORS[i % COLORS.length] }));

  const productCols = [
    { title: 'Product', dataIndex: 'name', key: 'n', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Units', dataIndex: 'quantitySold', key: 'u', align: 'right' as const, render: (v: number) => v.toFixed(0) },
    { title: 'Revenue', dataIndex: 'revenue', key: 'r', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];
  const catCols = [
    { title: 'Category', dataIndex: 'name', key: 'n', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Orders', dataIndex: 'orders', key: 'o', align: 'right' as const },
    { title: 'Revenue', dataIndex: 'revenue', key: 'r', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card variant="borderless" style={{ borderRadius: 14, background: '#fff9f0', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Best Seller</Text>
            <div style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 2px' }}>{products[0]?.name ?? '—'}</div>
            <Text type="secondary">{products[0] ? `${products[0].quantitySold.toFixed(0)} units · ${formatCurrency(products[0].revenue)}` : ''}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card variant="borderless" style={{ borderRadius: 14, background: '#f0f9ff', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Best Category</Text>
            <div style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 2px' }}>{categories[0]?.name ?? '—'}</div>
            <Text type="secondary">{categories[0] ? formatCurrency(categories[0].revenue) : ''}</Text>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Best Sellers by Revenue">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top10Rev} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} width={48} />
                <RechartsTip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {top10Rev.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Best Sellers by Units Sold">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top10Units} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <RechartsTip />
                <Bar dataKey="quantitySold" name="Units" radius={[4, 4, 0, 0]}>
                  {top10Units.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Best Selling Products">
            <Table columns={productCols} dataSource={products.slice(0, 10)} rowKey="productId" pagination={false} size="small" />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Best Selling Categories">
            {treemapData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} content={<TreemapBlock />} />
                </ResponsiveContainer>
                <Table columns={catCols} dataSource={categories} rowKey="categoryId" pagination={false} size="small" style={{ marginTop: 10 }} />
              </>
            ) : <Empty description="No data" />}
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
};

// ─── LEADS (CRM) ──────────────────────────────────────────────────────────────
const LeadsSection: React.FC = () => {
  const { data: quotes } = useQuery({
    queryKey: ['quotes-all'], queryFn: () => salesApi.getQuotes(1, 50),
  });

  const leads = (quotes?.data || []).filter(q => ['DRAFT', 'SENT'].includes(q.status));
  const accepted = (quotes?.data || []).filter(q => q.status === 'ACCEPTED');
  const declined = (quotes?.data || []).filter(q => ['DECLINED', 'EXPIRED'].includes(q.status));

  const cols = [
    { title: 'Customer', dataIndex: ['customer', 'name'], key: 'c', render: (v: string) => <Text style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Quote #', dataIndex: 'quoteNumber', key: 'q' },
    { title: 'Amount', dataIndex: 'total', key: 'a', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Status', dataIndex: 'status', key: 's', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    { title: 'Date', dataIndex: 'createdAt', key: 'd', render: (v: string) => formatDate(v) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}><KpiTile label="Open Leads" value={leads.length} color="#fa8c16" /></Col>
        <Col xs={12} sm={8}><KpiTile label="Won" value={accepted.length} color="#52c41a" /></Col>
        <Col xs={12} sm={8}><KpiTile label="Lost" value={declined.length} color="#ff4d4f" /></Col>
      </Row>
      <SectionCard title="Open Leads / Quotes">
        {leads.length > 0
          ? <Table columns={cols} dataSource={leads} rowKey="id" pagination={false} size="small" />
          : <Empty description="No open leads" />}
      </SectionCard>
    </Space>
  );
};

// ─── PIPELINE (CRM) ───────────────────────────────────────────────────────────
const PipelineSection: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const { data: quoteConv } = useQuery({
    queryKey: ['quote-conversion', startDate, endDate],
    queryFn: () => analyticsApi.getQuoteConversion(startDate, endDate),
  });
  const { data: quotes } = useQuery({
    queryKey: ['quotes-all'], queryFn: () => salesApi.getQuotes(1, 100),
  });

  const statusOrder = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'];
  const funnelData = statusOrder.map((s, i) => ({
    name: s,
    value: (quotes?.data || []).filter(q => q.status === s).length,
    fill: COLORS[i],
  })).filter(d => d.value > 0);

  const cols = [
    { title: 'Stage', dataIndex: 'name', key: 's', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    { title: 'Count', dataIndex: 'value', key: 'c', align: 'right' as const },
    {
      title: 'Value', key: 'val', align: 'right' as const,
      render: (_: any, r: any) => formatCurrency((quotes?.data || []).filter(q => q.status === r.name).reduce((s, q) => s + Number(q.total), 0)),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><KpiTile label="Total Quotes" value={quoteConv?.total ?? 0} color="#1677ff" /></Col>
        <Col xs={12} sm={6}><KpiTile label="Converted" value={quoteConv?.converted ?? 0} color="#52c41a" /></Col>
        <Col xs={12} sm={6}><KpiTile label="Pending" value={quoteConv?.pending ?? 0} color="#fa8c16" /></Col>
        <Col xs={12} sm={6}><KpiTile label="Conversion Rate" value={`${quoteConv?.conversionRate ?? 0}%`} color="#722ed1" /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Quote Funnel">
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <RechartsTip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#333" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Pipeline by Stage">
            <Table columns={cols} dataSource={funnelData} rowKey="name" pagination={false} size="small" />
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
};

// ─── POINT OF SALE ────────────────────────────────────────────────────────────
const PosSection: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const { data: cashInvoices } = useQuery({
    queryKey: ['invoices-cash-top'], queryFn: () => salesApi.getInvoices(1, 50, 'PAID'),
  });
  const { data: pm } = useQuery({
    queryKey: ['payment-method', startDate, endDate],
    queryFn: () => analyticsApi.getSalesByPaymentMethod(startDate, endDate),
  });

  const pmData = pm?.data || [];
  const cashEntry = pmData.find(p => p.paymentMethod === 'CASH');
  const totalReceived = pm?.total ?? 0;

  const cols = [
    { title: 'Invoice #', dataIndex: 'invoiceNo', key: 'inv' },
    { title: 'Customer', dataIndex: ['customer', 'name'], key: 'c', render: (v: string) => v || <Text type="secondary">Walk-in</Text> },
    { title: 'Method', dataIndex: 'paymentMethod', key: 'm', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Amount', dataIndex: 'total', key: 'a', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Date', dataIndex: 'invoiceDate', key: 'd', render: (v: string) => formatDate(v) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><KpiTile label="Total Collected" value={formatCurrency(totalReceived)} color="#1677ff" /></Col>
        <Col xs={24} sm={8}><KpiTile label="Cash Sales" value={formatCurrency(cashEntry?.amount ?? 0)} color="#52c41a" /></Col>
        <Col xs={24} sm={8}><KpiTile label="Transactions" value={cashInvoices?.pagination?.total ?? 0} color="#fa8c16" /></Col>
      </Row>
      <SectionCard title="Payment Methods">
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {pmData.map((pm, i) => (
            <div key={pm.paymentMethod}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>{pm.paymentMethod}</Text>
                <Space>
                  <Text strong>{formatCurrency(pm.amount)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>({pm.count} txn)</Text>
                </Space>
              </div>
              <Progress percent={Math.round((pm.amount / (totalReceived || 1)) * 100)} strokeColor={COLORS[i % COLORS.length]} showInfo={false} size="small" />
            </div>
          ))}
        </Space>
      </SectionCard>
      <SectionCard title="Recent POS Transactions">
        <Table columns={cols} dataSource={(cashInvoices?.data || []).slice(0, 15)} rowKey="id" pagination={false} size="small" />
      </SectionCard>
    </Space>
  );
};

// ─── WAREHOUSE ────────────────────────────────────────────────────────────────
const WarehouseSection: React.FC = () => {
  const { data: inventory } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => analyticsApi.getInventorySummary(),
  });

  const catData = inventory?.byCategory || [];
  const treemapData = catData.map((c, i) => ({ name: c.category, size: c.totalValue, fill: COLORS[i % COLORS.length] }));

  const cols = [
    { title: 'Category', dataIndex: 'category', key: 'c', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Products', dataIndex: 'count', key: 'n', align: 'right' as const },
    { title: 'Low Stock', dataIndex: 'lowStockCount', key: 'l', align: 'right' as const, render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag> },
    { title: 'Stock Value', dataIndex: 'totalValue', key: 'v', align: 'right' as const, render: (v: number) => formatCurrency(v) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><KpiTile label="Total Products" value={inventory?.totalProducts ?? 0} color="#1677ff" /></Col>
        <Col xs={24} sm={8}><KpiTile label="Stock Value" value={formatCurrency(inventory?.totalValue ?? 0)} color="#52c41a" /></Col>
        <Col xs={24} sm={8}><KpiTile label="Low Stock Items" value={inventory?.totalLowStock ?? 0} color="#ff4d4f" /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title="Stock Value by Category">
            {treemapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} content={<TreemapBlock />} />
              </ResponsiveContainer>
            ) : <Empty description="No data" />}
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title="Inventory by Category">
            <Table columns={cols} dataSource={catData} rowKey="category" pagination={false} size="small" />
          </SectionCard>
        </Col>
      </Row>
    </Space>
  );
};

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
type Section = 'accounting' | 'invoicing' | 'benchmark' | 'expenses'
  | 'sales' | 'product' | 'pos'
  | 'leads' | 'pipeline'
  | 'warehouse';

const NAV_ITEMS = [
  {
    type: 'group' as const,
    label: 'SALES',
    children: [
      { key: 'sales', label: 'Sales', icon: <ShoppingOutlined /> },
      { key: 'product', label: 'Product', icon: <AppstoreOutlined /> },
      { key: 'pos', label: 'Point of Sale', icon: <ShopOutlined /> },
    ],
  },
  {
    type: 'group' as const,
    label: 'CRM',
    children: [
      { key: 'leads', label: 'Leads', icon: <TeamOutlined /> },
      { key: 'pipeline', label: 'Pipeline', icon: <FundOutlined /> },
    ],
  },
  {
    type: 'group' as const,
    label: 'FINANCE',
    children: [
      { key: 'accounting', label: 'Accounting', icon: <ReconciliationOutlined /> },
      { key: 'invoicing', label: 'Invoicing', icon: <FileTextOutlined /> },
      { key: 'benchmark', label: 'Benchmark', icon: <BarChartOutlined /> },
      { key: 'expenses', label: 'Expenses', icon: <DollarOutlined /> },
    ],
  },
  {
    type: 'group' as const,
    label: 'LOGISTICS',
    children: [
      { key: 'warehouse', label: 'Warehouse', icon: <TruckOutlined /> },
    ],
  },
];

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const AnalyticsPage: React.FC = () => {
  const [section, setSection] = useState<Section>('accounting');
  const [preset, setPreset] = useState<PeriodPreset>('last90');
  const [offset, setOffset] = useState(0);
  const [granularity, setGranularity] = useState<'day' | 'month'>('month');
  const [year, setYear] = useState(dayjs().year());

  const period = useMemo(() => computePeriod(preset, offset), [preset, offset]);

  const useYearNav = section === 'accounting' || section === 'benchmark';

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Left sidebar */}
      <div style={{ width: 190, flexShrink: 0 }}>
        <Card variant="borderless" style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', padding: 0 }} styles={{ body: { padding: '8px 0' } }}>
          <Menu
            mode="inline"
            selectedKeys={[section]}
            onSelect={({ key }) => setSection(key as Section)}
            items={NAV_ITEMS}
            style={{ border: 'none', background: 'transparent' }}
          />
        </Card>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Period / year selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {useYearNav ? (
            <>
              <Button icon={<LeftOutlined />} onClick={() => setYear(y => y - 1)} shape="circle" size="small" />
              <Text style={{ minWidth: 60, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{year}</Text>
              <Button icon={<RightOutlined />} onClick={() => setYear(y => Math.min(dayjs().year(), y + 1))} shape="circle" size="small" disabled={year >= dayjs().year()} />
            </>
          ) : (
            <>
              <Segmented options={PRESETS} value={preset} onChange={(v) => { setPreset(v as PeriodPreset); setOffset(0); }} />
              <Button icon={<LeftOutlined />} onClick={() => setOffset(o => o + 1)} shape="circle" size="small" />
              <Text style={{ minWidth: 180, textAlign: 'center', fontWeight: 500 }}>{periodLabel(preset, offset)}</Text>
              <Button icon={<RightOutlined />} onClick={() => setOffset(o => Math.max(0, o - 1))} shape="circle" size="small" disabled={offset === 0} />
              {offset !== 0 && <Button size="small" onClick={() => setOffset(0)} style={{ borderRadius: 999 }}>Current</Button>}
              {section === 'expenses' && (
                <Segmented
                  size="small"
                  options={[{ label: 'Daily', value: 'day' }, { label: 'Monthly', value: 'month' }]}
                  value={granularity}
                  onChange={(v) => setGranularity(v as 'day' | 'month')}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </>
          )}
        </div>

        {/* Section content */}
        {section === 'accounting' && <AccountingSection year={year} />}
        {section === 'invoicing' && <InvoicingSection startDate={period.start} endDate={period.end} />}
        {section === 'benchmark' && <BenchmarkSection year={year} />}
        {section === 'expenses' && <ExpensesSection startDate={period.start} endDate={period.end} granularity={granularity} />}
        {section === 'sales' && <SalesSection startDate={period.start} endDate={period.end} />}
        {section === 'product' && <ProductSection startDate={period.start} endDate={period.end} />}
        {section === 'pos' && <PosSection startDate={period.start} endDate={period.end} />}
        {section === 'leads' && <LeadsSection />}
        {section === 'pipeline' && <PipelineSection startDate={period.start} endDate={period.end} />}
        {section === 'warehouse' && <WarehouseSection />}
      </div>
    </div>
  );
};

export default AnalyticsPage;
