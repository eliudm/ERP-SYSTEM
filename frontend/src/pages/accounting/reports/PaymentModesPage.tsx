import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Button, Statistic, Row, Col, Tag,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency } from '../../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

export const PaymentModesPage: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payment-modes', dates],
    queryFn: () => accountingApi.getPaymentModesReport(dates[0], dates[1]),
  });

  const columns = [
    {
      title: 'Payment Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (v: string) => <Tag>{METHOD_LABELS[v] || v}</Tag>,
    },
    { title: 'Sales (count)', dataIndex: 'salesCount', key: 'salesCount', align: 'right' as const },
    {
      title: 'Sales Amount (KES)', dataIndex: 'salesAmount', key: 'salesAmount', align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Bank Lines', dataIndex: 'bankLines', key: 'bankLines', align: 'right' as const,
    },
    {
      title: 'Matched (KES)', dataIndex: 'matchedBankAmount', key: 'matchedBankAmount', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{formatCurrency(v)}</Text>,
    },
    {
      title: 'Unmatched (KES)', dataIndex: 'unmatchedBankAmount', key: 'unmatchedBankAmount', align: 'right' as const,
      render: (v: number) => (v !== 0 ? <Text style={{ color: '#f5222d' }}>{formatCurrency(v)}</Text> : '—'),
    },
    {
      title: 'Variance (KES)', dataIndex: 'variance', key: 'variance', align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: Math.abs(v) < 0.01 ? '#52c41a' : '#f5222d' }}>
          {formatCurrency(v)}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Payment Modes Reconciliation</Title>
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
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Sales"
              value={data?.totals?.salesAmount || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Bank Lines"
              value={data?.totals?.bankAmount || 0}
              formatter={(v) => formatCurrency(Number(v))}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Matched"
              value={data?.totals?.matchedBankAmount || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.rows || []}
          rowKey="paymentMethod"
          loading={isLoading}
          pagination={false}
        />
      </Card>
    </Space>
  );
};
