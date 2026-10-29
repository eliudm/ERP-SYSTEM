import React, { useState } from 'react';
import {
  Row, Col, Card, Statistic, Table,
  Tag, Typography, Space, DatePicker, Button,
  Avatar,
} from 'antd';
import type { Dayjs } from 'dayjs';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  DollarOutlined, FileTextOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
  ShoppingCartOutlined, TeamOutlined,
  InboxOutlined, ShoppingOutlined,
  AccountBookOutlined, SettingOutlined,
  SafetyCertificateOutlined, BarChartOutlined,
  UserOutlined, ClusterOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { salesApi } from '../../api/sales.api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Chart colors
const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d'];

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const currentYear = dayjs().year();
  const defaultRange: [Dayjs, Dayjs] = [dayjs().startOf('year'), dayjs()];
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(defaultRange);
  const startDate = dateRange[0].format('YYYY-MM-DD');
  const endDate = dateRange[1].format('YYYY-MM-DD');

  const handleDateRangeChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (values && values[0] && values[1]) {
      setDateRange([values[0], values[1]]);
    } else {
      setDateRange(defaultRange);
    }
  };

  const appTiles = [
    {
      key: '/sales/pos',
      title: t('tiles.pos.title'),
      description: t('tiles.pos.description'),
      icon: <ShoppingCartOutlined />,
      accent: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
    },
    {
      key: '/sales/invoices',
      title: t('tiles.sales.title'),
      description: t('tiles.sales.description'),
      icon: <BarChartOutlined />,
      accent: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      key: '/inventory/products',
      title: t('tiles.inventory.title'),
      description: t('tiles.inventory.description'),
      icon: <InboxOutlined />,
      accent: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
    },
    {
      key: '/procurement/purchase-orders',
      title: t('tiles.purchase.title'),
      description: t('tiles.purchase.description'),
      icon: <ShoppingOutlined />,
      accent: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    },
    {
      key: '/accounting/accounts',
      title: t('tiles.accounting.title'),
      description: t('tiles.accounting.description'),
      icon: <AccountBookOutlined />,
      accent: 'linear-gradient(135deg, #a044ff 0%, #6a3093 100%)',
    },
    {
      key: '/hr/employees',
      title: t('tiles.employees.title'),
      description: t('tiles.employees.description'),
      icon: <TeamOutlined />,
      accent: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    },
    {
      key: '/sales/customers',
      title: t('tiles.customers.title'),
      description: t('tiles.customers.description'),
      icon: <UserOutlined />,
      accent: 'linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)',
    },
    {
      key: '/inventory/movements',
      title: t('tiles.stockFlow.title'),
      description: t('tiles.stockFlow.description'),
      icon: <ClusterOutlined />,
      accent: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
    },
    {
      key: '/etims/config',
      title: t('tiles.etims.title'),
      description: t('tiles.etims.description'),
      icon: <SafetyCertificateOutlined />,
      accent: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
    },
    {
      key: '/settings/general',
      title: t('tiles.settings.title'),
      description: t('tiles.settings.description'),
      icon: <SettingOutlined />,
      accent: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
    },
  ];

  const { data: summary, isLoading } = useQuery({
    queryKey: ['sales-summary', startDate, endDate],
    queryFn: () => salesApi.getSalesSummary(startDate, endDate),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => salesApi.getInvoices(1, 5),
  });

  const { data: monthlySales } = useQuery({
    queryKey: ['monthly-sales', currentYear],
    queryFn: () => salesApi.getMonthlySales(currentYear),
  });

  const monthlyData = (monthlySales?.months || []).map((m: any) => ({
    month: m.month,
    revenue: m.revenue,
    paid: m.paid,
  }));

  const pieData = [
    { name: t('paid'), value: Number(summary?.totalPaid || 0) },
    { name: t('outstanding'), value: Number(summary?.outstanding || 0) },
  ];

  const recentColumns = [
    {
      title: t('invoiceNo'),
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (v: string) => (
        <Text strong style={{ color: '#1677ff' }}>{v}</Text>
      ),
    },
    {
      title: t('common:customer'),
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: t('common:amount'),
      dataIndex: 'total',
      key: 'total',
      render: (v: number) => formatCurrency(Number(v)),
    },
    {
      title: t('common:date'),
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (v: string) => formatDate(v),
    },
    {
      title: t('common:status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={getStatusColor(v)}>{v}</Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div
        style={{
          padding: 28,
          borderRadius: 30,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(255,249,244,0.92) 100%)',
          boxShadow: '0 24px 60px rgba(96, 84, 138, 0.08)',
          border: '1px solid rgba(122, 108, 173, 0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <Tag color="gold" style={{ borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>
              {t('workspaceOverview')}
            </Tag>
            <Title level={2} style={{ margin: 0, color: '#2f2749' }}>{t('common:appName')}</Title>
            <Text type="secondary" style={{ fontSize: 15 }}>
              {t('tagline')}
            </Text>
          </div>

          <Space wrap size="middle" style={{ alignItems: 'center' }}>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              allowClear={false}
              style={{ borderRadius: 999 }}
            />
            <Button
              type="primary"
              size="large"
              style={{
                borderRadius: 999,
                background: 'linear-gradient(135deg, #6f67ff 0%, #1db8a0 100%)',
                border: 'none',
                boxShadow: '0 12px 30px rgba(84, 73, 126, 0.18)',
              }}
              onClick={() => navigate('/sales/pos')}
            >
              {t('openPos')}
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.82)' }}>
              <Statistic
                title={t('revenueThisYear')}
                value={Number(summary?.totalRevenue || 0)}
                formatter={(v) => formatCurrency(Number(v))}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#2b8a5a' }}
              />
              <Text type="secondary">
                <ArrowUpOutlined style={{ color: '#2b8a5a' }} /> {t('revenueThisYearDesc')}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.82)' }}>
              <Statistic
                title={t('outstanding')}
                value={Number(summary?.outstanding || 0)}
                formatter={(v) => formatCurrency(Number(v))}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#d48806' }}
              />
              <Text type="secondary">
                <ArrowDownOutlined style={{ color: '#d48806' }} /> {t('outstandingDesc')}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.82)' }}>
              <Statistic
                title={t('invoicesStat')}
                value={summary?.totalInvoices || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#5b54f3' }}
              />
              <Text type="secondary">{t('invoicesStatDesc')}</Text>
            </Card>
          </Col>
        </Row>
      </div>

      <Card
        bordered={false}
        style={{
          borderRadius: 30,
          background: 'rgba(255,255,255,0.7)',
          boxShadow: '0 24px 60px rgba(96, 84, 138, 0.08)',
        }}
        bodyStyle={{ padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
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
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                <Card
                  hoverable
                  bordered={false}
                  style={{
                    borderRadius: 24,
                    minHeight: 182,
                    background: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 18px 44px rgba(96, 84, 138, 0.08)',
                  }}
                  bodyStyle={{ padding: 18 }}
                >
                  <Avatar
                    size={52}
                    icon={tile.icon}
                    style={{
                      background: tile.accent,
                      boxShadow: '0 10px 26px rgba(84, 73, 126, 0.16)',
                      marginBottom: 16,
                    }}
                  />
                  <Title level={5} style={{ margin: 0, color: '#2f2749' }}>{tile.title}</Title>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8, lineHeight: 1.45 }}>
                    {tile.description}
                  </Text>
                </Card>
              </button>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.72)' }}>
            <Statistic
              title={t('totalRevenue')}
              value={Number(summary?.totalRevenue || 0)}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowUpOutlined style={{ color: '#52c41a' }} /> {t('ytd', { year: currentYear })}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.72)' }}>
            <Statistic
              title={t('totalInvoices')}
              value={summary?.totalInvoices || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('totalInvoicesDesc')}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.72)' }}>
            <Statistic
              title={t('outstanding')}
              value={Number(summary?.outstanding || 0)}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowDownOutlined style={{ color: '#fa8c16' }} /> {t('outstandingDesc2')}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.72)' }}>
            <Statistic
              title={t('totalCollected')}
              value={Number(summary?.totalPaid || 0)}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('totalCollectedDesc')}
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card bordered={false} title={t('revenueVsPaid')} style={{ height: 360, borderRadius: 28, background: 'rgba(255,255,255,0.72)' }}>
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1677ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f5222d" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f5222d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis
                  tickFormatter={(v) =>
                    `${(v / 1000).toFixed(0)}K`
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1677ff"
                  fill="url(#revenue)"
                  name={t('revenueSeries')}
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="#52c41a"
                  fill="url(#expenses)"
                  name={t('paidSeries')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card bordered={false} title={t('invoiceCollection')} style={{ height: 360, borderRadius: 28, background: 'rgba(255,255,255,0.72)' }}>
            <ResponsiveContainer width="100%" height={270}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title={t('recentInvoices')} style={{ borderRadius: 28, background: 'rgba(255,255,255,0.72)' }}>
        <Table
          columns={recentColumns}
          dataSource={invoicesData?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
          onRow={(record: any) => ({
            onClick: () => navigate(`/sales/invoices/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </Space>
  );
};
