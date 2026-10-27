import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Button, Statistic, Row, Col,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate } from '../../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Transaction {
  description: string;
  amount: number;
  date: string;
}

const txColumns = [
  { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => formatDate(v) },
  { title: 'Description', dataIndex: 'description', key: 'description' },
  {
    title: 'Amount (KES)',
    dataIndex: 'amount',
    key: 'amount',
    align: 'right' as const,
    render: (v: number) => (
      <Text style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}>{formatCurrency(v)}</Text>
    ),
  },
];

const ActivitySection: React.FC<{
  title: string;
  total: number;
  transactions: Transaction[];
  loading: boolean;
}> = ({ title, total, transactions, loading }) => (
  <Card
    title={
      <Space>
        <Text strong>{title}</Text>
        <Text strong style={{ color: total >= 0 ? '#52c41a' : '#f5222d' }}>
          {formatCurrency(total)}
        </Text>
      </Space>
    }
  >
    <Table
      columns={txColumns}
      dataSource={transactions}
      rowKey={(r) => `${r.date}-${r.description}-${r.amount}`}
      loading={loading}
      pagination={false}
      locale={{ emptyText: 'No transactions in this period' }}
    />
  </Card>
);

export const CashFlowPage: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cash-flow', dates],
    queryFn: () => accountingApi.getCashFlow(dates[0], dates[1]),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Cash Flow Statement</Title>
        <Space>
          <RangePicker
            defaultValue={[dayjs().startOf('month'), dayjs()]}
            onChange={(_, strings) => {
              if (strings[0] && strings[1]) setDates([strings[0], strings[1]]);
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Generate
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Operating"
              value={data?.operating?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.operating?.total || 0) >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Investing"
              value={data?.investing?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.investing?.total || 0) >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Financing"
              value={data?.financing?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.financing?.total || 0) >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Net Change in Cash"
              value={data?.netChange || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.netChange || 0) >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <ActivitySection
        title="Operating Activities"
        total={data?.operating?.total || 0}
        transactions={data?.operating?.transactions || []}
        loading={isLoading}
      />
      <ActivitySection
        title="Investing Activities"
        total={data?.investing?.total || 0}
        transactions={data?.investing?.transactions || []}
        loading={isLoading}
      />
      <ActivitySection
        title="Financing Activities"
        total={data?.financing?.total || 0}
        transactions={data?.financing?.transactions || []}
        loading={isLoading}
      />
    </Space>
  );
};
