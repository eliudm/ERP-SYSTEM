import React from 'react';
import { Card, Col, DatePicker, Row, Space, Statistic, Typography } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import dayjs from 'dayjs';
import { salesApi } from '../../api/sales.api';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

export const POSReportingPage: React.FC = () => {
  const thisYear = dayjs().year();
  const [year, setYear] = useState(thisYear);
  const today = dayjs().format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

  const { data: monthly } = useQuery({
    queryKey: ['monthly-sales', year],
    queryFn: () => salesApi.getMonthlySales(year),
  });

  const { data: todaySummary } = useQuery({
    queryKey: ['summary-today', today],
    queryFn: () => salesApi.getSalesSummary(today, today),
  });

  const { data: weekSummary } = useQuery({
    queryKey: ['summary-week', weekStart, today],
    queryFn: () => salesApi.getSalesSummary(weekStart, today),
  });

  const { data: monthSummary } = useQuery({
    queryKey: ['summary-month', monthStart, today],
    queryFn: () => salesApi.getSalesSummary(monthStart, today),
  });

  const monthlyData = (monthly?.months ?? []).map((m: any) => ({
    month: m.month,
    Revenue: Number(m.revenue),
    Paid: Number(m.paid),
    Orders: m.invoices,
  }));

  const todayRevenue: number = (todaySummary as any)?.totalRevenue ?? 0;
  const todayOrders: number = (todaySummary as any)?.totalInvoices ?? 0;
  const weekRevenue: number = (weekSummary as any)?.totalRevenue ?? 0;
  const monthRevenue: number = (monthSummary as any)?.totalRevenue ?? 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Reporting</Title>
        <DatePicker
          picker="year"
          value={dayjs().year(year)}
          onChange={(d) => d && setYear(d.year())}
          allowClear={false}
        />
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Statistic
              title="Today's Sales"
              value={todayRevenue}
              formatter={(v) => formatCurrency(Number(v))}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{todayOrders} orders</Text>}
              valueStyle={{ color: '#389e0d', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#e6f7ff', border: '1px solid #91d5ff' }}>
            <Statistic
              title="This Week"
              value={weekRevenue}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#1677ff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#fff7e6', border: '1px solid #ffd591' }}>
            <Statistic
              title="This Month"
              value={monthRevenue}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#d46b08', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Monthly revenue bar chart */}
      <Card
        title={`Monthly Revenue — ${year}`}
        bordered={false}
        style={{ borderRadius: 12 }}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="Revenue" fill="#1677ff" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Paid" fill="#52c41a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Orders trend line chart */}
      <Card
        title="Order Count by Month"
        bordered={false}
        style={{ borderRadius: 12 }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip />
            <Legend />
            <Line type="monotone" dataKey="Orders" stroke="#722ed1" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </Space>
  );
};

export default POSReportingPage;
