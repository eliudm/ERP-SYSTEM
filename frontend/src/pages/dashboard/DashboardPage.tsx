import React, { useState, useMemo } from 'react';
import {
  Row, Col, Card, Table,
  Tag, Typography, Space, Button,
  Avatar, Segmented,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  ShoppingCartOutlined, TeamOutlined,
  InboxOutlined, ShoppingOutlined,
  AccountBookOutlined, SettingOutlined,
  SafetyCertificateOutlined, BarChartOutlined,
  UserOutlined, ClusterOutlined,
  LeftOutlined, RightOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { salesApi } from '../../api/sales.api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

type PeriodPreset = 'last30' | 'last90' | 'thisMonth' | 'thisYear';

const PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'Last 90 Days', value: 'last90' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'This Year', value: 'thisYear' },
];

function computePeriod(preset: PeriodPreset, offset: number): { start: string; end: string } {
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
    default: // thisYear
      end = today.subtract(offset, 'year').endOf('year');
      start = today.subtract(offset, 'year').startOf('year');
  }

  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
  };
}

function getPeriodLabel(preset: PeriodPreset, offset: number): string {
  if (offset === 0) {
    return PRESETS.find(p => p.value === preset)?.label ?? '';
  }
  const { start, end } = computePeriod(preset, offset);
  return `${dayjs(start).format('D MMM')} – ${dayjs(end).format('D MMM YYYY')}`;
}

function pctChange(current: number, prev: number): number | null {
  if (!prev) return null;
  return ((current - prev) / prev) * 100;
}

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  pct: number | null;
  accentColor: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, pct, accentColor }) => {
  const isUp = pct !== null && pct >= 0;
  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        borderTop: `4px solid ${accentColor}`,
        height: '100%',
      }}
    >
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{title}</Text>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>{value}</div>
      {pct !== null ? (
        <Space size={4}>
          {isUp
            ? <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            : <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
          <Text style={{ color: isUp ? '#52c41a' : '#ff4d4f', fontSize: 12, fontWeight: 600 }}>
            {Math.abs(pct).toFixed(1)}%
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>since last period</Text>
        </Space>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      )}
    </Card>
  );
};

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const currentYear = dayjs().year();

  const [preset, setPreset] = useState<PeriodPreset>('last90');
  const [offset, setOffset] = useState(0);

  const period = useMemo(() => computePeriod(preset, offset), [preset, offset]);
  const prevPeriod = useMemo(() => computePeriod(preset, offset + 1), [preset, offset]);

  const handlePresetChange = (val: string | number) => {
    setPreset(val as PeriodPreset);
    setOffset(0);
  };

  const { data: summary } = useQuery({
    queryKey: ['sales-summary', period.start, period.end],
    queryFn: () => salesApi.getSalesSummary(period.start, period.end),
  });

  const { data: prevSummary } = useQuery({
    queryKey: ['sales-summary', prevPeriod.start, prevPeriod.end],
    queryFn: () => salesApi.getSalesSummary(prevPeriod.start, prevPeriod.end),
  });

  const { data: monthlySales } = useQuery({
    queryKey: ['monthly-sales', currentYear],
    queryFn: () => salesApi.getMonthlySales(currentYear),
  });

  const { data: topInvoices } = useQuery({
    queryKey: ['top-invoices'],
    queryFn: () => salesApi.getInvoices(1, 5),
  });

  const { data: topQuotes } = useQuery({
    queryKey: ['top-quotes'],
    queryFn: () => salesApi.getQuotes(1, 5),
  });

  // KPI values
  const revenue = Number(summary?.totalRevenue || 0);
  const prevRevenue = Number(prevSummary?.totalRevenue || 0);
  const orders = summary?.totalInvoices || 0;
  const prevOrders = prevSummary?.totalInvoices || 0;
  const collected = Number(summary?.totalPaid || 0);
  const prevCollected = Number(prevSummary?.totalPaid || 0);
  const avgOrder = orders > 0 ? revenue / orders : 0;
  const prevAvgOrder = (prevSummary?.totalInvoices ?? 0) > 0 ? prevRevenue / (prevSummary?.totalInvoices ?? 1) : 0;

  const monthlyData = (monthlySales?.months || []).map((m) => ({
    month: m.month,
    revenue: m.revenue,
    paid: m.paid,
  }));

  const appTiles = [
    { key: '/sales/pos', title: t('tiles.pos.title'), description: t('tiles.pos.description'), icon: <ShoppingCartOutlined />, accent: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)' },
    { key: '/sales/invoices', title: t('tiles.sales.title'), description: t('tiles.sales.description'), icon: <BarChartOutlined />, accent: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { key: '/inventory/products', title: t('tiles.inventory.title'), description: t('tiles.inventory.description'), icon: <InboxOutlined />, accent: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' },
    { key: '/procurement/purchase-orders', title: t('tiles.purchase.title'), description: t('tiles.purchase.description'), icon: <ShoppingOutlined />, accent: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
    { key: '/accounting/accounts', title: t('tiles.accounting.title'), description: t('tiles.accounting.description'), icon: <AccountBookOutlined />, accent: 'linear-gradient(135deg, #a044ff 0%, #6a3093 100%)' },
    { key: '/hr/employees', title: t('tiles.employees.title'), description: t('tiles.employees.description'), icon: <TeamOutlined />, accent: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { key: '/sales/customers', title: t('tiles.customers.title'), description: t('tiles.customers.description'), icon: <UserOutlined />, accent: 'linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)' },
    { key: '/inventory/movements', title: t('tiles.stockFlow.title'), description: t('tiles.stockFlow.description'), icon: <ClusterOutlined />, accent: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
    { key: '/etims/config', title: t('tiles.etims.title'), description: t('tiles.etims.description'), icon: <SafetyCertificateOutlined />, accent: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)' },
    { key: '/settings/general', title: t('tiles.settings.title'), description: t('tiles.settings.description'), icon: <SettingOutlined />, accent: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)' },
  ];

  const invoiceColumns = [
    {
      title: 'Invoice #', dataIndex: 'invoiceNo', key: 'invoiceNo',
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    { title: t('common:customer'), dataIndex: ['customer', 'name'], key: 'customer' },
    { title: t('common:amount'), dataIndex: 'total', key: 'total', render: (v: number) => formatCurrency(Number(v)) },
    { title: t('common:date'), dataIndex: 'invoiceDate', key: 'date', render: (v: string) => formatDate(v) },
    { title: t('common:status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
  ];

  const quoteColumns = [
    {
      title: 'Quote #', dataIndex: 'quoteNumber', key: 'quoteNumber',
      render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text>,
    },
    { title: t('common:customer'), dataIndex: ['customer', 'name'], key: 'customer' },
    { title: t('common:amount'), dataIndex: 'total', key: 'total', render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Valid Until', dataIndex: 'validUntil', key: 'validUntil', render: (v: string) => v ? formatDate(v) : '—' },
    { title: t('common:status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>{t('common:appName')}</Title>
        <Button
          type="primary"
          style={{
            borderRadius: 999,
            background: 'linear-gradient(135deg, #6f67ff 0%, #1db8a0 100%)',
            border: 'none',
          }}
          onClick={() => navigate('/sales/pos')}
        >
          {t('openPos')}
        </Button>
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Segmented
          options={PRESETS}
          value={preset}
          onChange={handlePresetChange}
        />
        <Button
          icon={<LeftOutlined />}
          onClick={() => setOffset(o => o + 1)}
          shape="circle"
          size="small"
        />
        <Text style={{ minWidth: 180, textAlign: 'center', fontWeight: 500 }}>
          {getPeriodLabel(preset, offset)}
        </Text>
        <Button
          icon={<RightOutlined />}
          onClick={() => setOffset(o => Math.max(0, o - 1))}
          shape="circle"
          size="small"
          disabled={offset === 0}
        />
        {offset !== 0 && (
          <Button size="small" onClick={() => setOffset(0)} style={{ borderRadius: 999 }}>
            Back to current
          </Button>
        )}
      </div>

      {/* KPI Tiles */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Revenue"
            value={formatCurrency(revenue)}
            pct={pctChange(revenue, prevRevenue)}
            accentColor="#1677ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Orders"
            value={orders}
            pct={pctChange(orders, prevOrders)}
            accentColor="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Collected"
            value={formatCurrency(collected)}
            pct={pctChange(collected, prevCollected)}
            accentColor="#fa8c16"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Avg. Order"
            value={formatCurrency(avgOrder)}
            pct={pctChange(avgOrder, prevAvgOrder)}
            accentColor="#722ed1"
          />
        </Col>
      </Row>

      {/* Monthly Sales Chart */}
      <Card
        bordered={false}
        title={<Text strong style={{ fontSize: 16 }}>Monthly Sales {currentYear}</Text>}
        style={{ borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1677ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52c41a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} width={48} />
            <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
            <Area type="monotone" dataKey="revenue" stroke="#1677ff" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
            <Area type="monotone" dataKey="paid" stroke="#52c41a" strokeWidth={2} fill="url(#colorPaid)" name="Collected" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Top Quotations & Top Sales Orders */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={<Text strong style={{ fontSize: 15 }}>Top Quotations</Text>}
            extra={<Button type="link" onClick={() => navigate('/sales/quotes')} style={{ padding: 0 }}>View all</Button>}
            style={{ borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <Table
              columns={quoteColumns}
              dataSource={topQuotes?.data || []}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record: any) => ({
                onClick: () => navigate(`/sales/quotes/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={<Text strong style={{ fontSize: 15 }}>Top Sales Orders</Text>}
            extra={<Button type="link" onClick={() => navigate('/sales/invoices')} style={{ padding: 0 }}>View all</Button>}
            style={{ borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <Table
              columns={invoiceColumns}
              dataSource={topInvoices?.data || []}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record: any) => ({
                onClick: () => navigate(`/sales/invoices/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* App Tiles */}
      <Card
        bordered={false}
        style={{ borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Title level={4} style={{ margin: 0, color: '#2f2749' }}>{t('apps')}</Title>
            <Text type="secondary">{t('appsSubtitle')}</Text>
          </div>
          <Tag color="blue" style={{ borderRadius: 999, padding: '4px 12px' }}>
            {t('modulesReady', { count: appTiles.length })}
          </Tag>
        </div>

        <Row gutter={[18, 18]}>
          {appTiles.map((tile) => (
            <Col key={tile.key} xs={12} sm={8} lg={6} xl={4}>
              <button
                type="button"
                onClick={() => navigate(tile.key)}
                style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <Card
                  hoverable
                  bordered={false}
                  style={{ borderRadius: 16, minHeight: 155, background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Avatar size={44} icon={tile.icon} style={{ background: tile.accent, marginBottom: 12 }} />
                  <Title level={5} style={{ margin: 0, color: '#2f2749' }}>{tile.title}</Title>
                  <Text type="secondary" style={{ display: 'block', marginTop: 6, lineHeight: 1.4, fontSize: 12 }}>
                    {tile.description}
                  </Text>
                </Card>
              </button>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
};
