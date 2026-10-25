import React, { useMemo, useState } from 'react';
import {
  Card, Col, Row, Space, Typography, DatePicker, Segmented, Table, Statistic, Tag, Empty,
} from 'antd';
import {
  DollarCircleOutlined, ShoppingCartOutlined, TeamOutlined, WarningOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  analyticsApi, type AnalyticsGranularity, type TopProduct, type TopCustomer,
  type PaymentMethodBreakdown, type InventoryCategorySummary,
} from '../../api/analytics.api';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DATE_FORMAT = 'YYYY-MM-DD';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CREDIT: 'Credit',
};

export const AnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('day');

  const startDate = range[0].format(DATE_FORMAT);
  const endDate = range[1].format(DATE_FORMAT);

  // ── Trend queries (depend on date range + granularity) ──
  const { data: salesTrend, isLoading: salesLoading } = useQuery({
    queryKey: ['analytics', 'sales-trend', startDate, endDate, granularity],
    queryFn: () => analyticsApi.getSalesTrend(startDate, endDate, granularity),
  });

  const { data: expenseTrend, isLoading: expenseLoading } = useQuery({
    queryKey: ['analytics', 'expense-trend', startDate, endDate, granularity],
    queryFn: () => analyticsApi.getExpenseTrend(startDate, endDate, granularity),
  });

  const { data: profitTrend, isLoading: profitLoading } = useQuery({
    queryKey: ['analytics', 'profit-trend', startDate, endDate, granularity],
    queryFn: () => analyticsApi.getProfitTrend(startDate, endDate, granularity),
  });

  // ── Date-range-only queries ──
  const { data: topProducts, isLoading: topProductsLoading } = useQuery({
    queryKey: ['analytics', 'top-products', startDate, endDate],
    queryFn: () => analyticsApi.getTopProducts(startDate, endDate, 10),
  });

  const { data: topCustomers, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['analytics', 'top-customers', startDate, endDate],
    queryFn: () => analyticsApi.getTopCustomers(startDate, endDate, 10),
  });

  const { data: paymentBreakdown, isLoading: paymentLoading } = useQuery({
    queryKey: ['analytics', 'sales-by-payment-method', startDate, endDate],
    queryFn: () => analyticsApi.getSalesByPaymentMethod(startDate, endDate),
  });

  // ── Independent of date range — loads on mount ──
  const { data: inventorySummary, isLoading: inventoryLoading } = useQuery({
    queryKey: ['analytics', 'inventory-summary'],
    queryFn: () => analyticsApi.getInventorySummary(),
  });

  // ── Merge the three trend series into one chart-ready array, by period ──
  const chartData = useMemo(() => {
    const periods = new Set<string>();
    (salesTrend?.data ?? []).forEach((d) => periods.add(d.period));
    (expenseTrend?.data ?? []).forEach((d) => periods.add(d.period));
    (profitTrend?.data ?? []).forEach((d) => periods.add(d.period));

    const salesByPeriod = new Map((salesTrend?.data ?? []).map((d) => [d.period, d.revenue]));
    const expenseByPeriod = new Map((expenseTrend?.data ?? []).map((d) => [d.period, d.amount]));
    const profitByPeriod = new Map((profitTrend?.data ?? []).map((d) => [d.period, d.profit]));

    return Array.from(periods)
      .sort()
      .map((period) => ({
        period,
        Sales: salesByPeriod.get(period) ?? 0,
        Expenses: expenseByPeriod.get(period) ?? 0,
        Profit: profitByPeriod.get(period) ?? 0,
      }));
  }, [salesTrend, expenseTrend, profitTrend]);

  const trendLoading = salesLoading || expenseLoading || profitLoading;

  const paymentChartData = useMemo(
    () =>
      (paymentBreakdown?.data ?? []).map((d) => ({
        method: PAYMENT_METHOD_LABELS[d.paymentMethod] ?? d.paymentMethod,
        Amount: d.amount,
      })),
    [paymentBreakdown],
  );

  const topProductColumns: ColumnsType<TopProduct> = [
    { title: '#', key: 'rank', width: 40, render: (_v, _r, i) => i + 1 },
    { title: 'Product', dataIndex: 'name', key: 'name', render: (v, r) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.code}</Text>
      </Space>
    ) },
    { title: 'Qty Sold', dataIndex: 'quantitySold', key: 'quantitySold', align: 'right' },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  ];

  const topCustomerColumns: ColumnsType<TopCustomer> = [
    { title: '#', key: 'rank', width: 40, render: (_v, _r, i) => i + 1 },
    { title: 'Customer', dataIndex: 'name', key: 'name', render: (v, r) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        {r.email && <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>}
      </Space>
    ) },
    { title: 'Invoices', dataIndex: 'invoiceCount', key: 'invoiceCount', align: 'right' },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  ];

  const paymentColumns: ColumnsType<PaymentMethodBreakdown> = [
    { title: 'Method', dataIndex: 'paymentMethod', key: 'paymentMethod', render: (v) => (
      <Tag color="blue">{PAYMENT_METHOD_LABELS[v] ?? v}</Tag>
    ) },
    { title: 'Transactions', dataIndex: 'count', key: 'count', align: 'right' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v) => formatCurrency(Number(v)) },
  ];

  const categoryColumns: ColumnsType<InventoryCategorySummary> = [
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Products', dataIndex: 'count', key: 'count', align: 'right' },
    { title: 'Low Stock', dataIndex: 'lowStockCount', key: 'lowStockCount', align: 'right', render: (v) => (
      v > 0 ? <Tag color="orange">{v}</Tag> : <Text type="secondary">0</Text>
    ) },
    { title: 'Value', dataIndex: 'totalValue', key: 'totalValue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* ── Header / controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Analytics</Title>
        <Space wrap>
          <Segmented
            value={granularity}
            onChange={(v) => setGranularity(v as AnalyticsGranularity)}
            options={[
              { label: 'Daily', value: 'day' },
              { label: 'Monthly', value: 'month' },
            ]}
          />
          <RangePicker
            value={range}
            allowClear={false}
            onChange={(values) => {
              if (values && values[0] && values[1]) {
                setRange([values[0], values[1]]);
              }
            }}
          />
        </Space>
      </div>

      {/* ── Inventory summary — loads independently of the date range ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} loading={inventoryLoading} style={{ borderRadius: 12, background: '#e6f7ff', border: '1px solid #91d5ff' }}>
            <Statistic
              title="Active Products"
              value={inventorySummary?.totalProducts ?? 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1677ff', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} loading={inventoryLoading} style={{ borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Statistic
              title="Inventory Value"
              value={inventorySummary?.totalValue ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<DollarCircleOutlined />}
              valueStyle={{ color: '#389e0d', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} loading={inventoryLoading} style={{ borderRadius: 12, background: '#fff7e6', border: '1px solid #ffd591' }}>
            <Statistic
              title="Low Stock Products"
              value={inventorySummary?.totalLowStock ?? 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#d46b08', fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Sales / Expense / Profit trend overlay ── */}
      <Card title="Sales, Expenses & Profit" bordered={false} style={{ borderRadius: 12 }} loading={trendLoading}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="Sales" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#fa8c16" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Profit" stroke="#722ed1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No data in this range" />
        )}
      </Card>

      {/* ── Top products / top customers ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><ShoppingCartOutlined /> Top Products</Space>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={topProductColumns}
              dataSource={topProducts?.data ?? []}
              loading={topProductsLoading}
              rowKey="productId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><TeamOutlined /> Top Customers</Space>}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={topCustomerColumns}
              dataSource={topCustomers?.data ?? []}
              loading={topCustomersLoading}
              rowKey="customerId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Sales by payment method ── */}
      <Card title="Sales by Payment Method" bordered={false} style={{ borderRadius: 12 }} loading={paymentLoading}>
        {paymentChartData.length > 0 ? (
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={paymentChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="Amount" fill="#1677ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} lg={10}>
              <Table
                columns={paymentColumns}
                dataSource={paymentBreakdown?.data ?? []}
                rowKey="paymentMethod"
                size="small"
                pagination={false}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} />
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong>{formatCurrency(Number(paymentBreakdown?.total ?? 0))}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Col>
          </Row>
        ) : (
          <Empty description="No paid sales in this range" />
        )}
      </Card>

      {/* ── Inventory by category ── */}
      <Card title="Inventory by Category" bordered={false} style={{ borderRadius: 12 }} loading={inventoryLoading}>
        <Table
          columns={categoryColumns}
          dataSource={inventorySummary?.byCategory ?? []}
          rowKey="category"
          size="small"
          pagination={false}
        />
      </Card>
    </Space>
  );
};

export default AnalyticsPage;
