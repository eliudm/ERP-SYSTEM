import React from 'react';
import { Card, Typography, Space, Table, Statistic, Row, Col, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate } from '../../../utils/format';

const { Title, Text } = Typography;

const BUCKETS: { key: string; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'days30', label: '1-30 Days' },
  { key: 'days60', label: '31-60 Days' },
  { key: 'days90', label: '61-90 Days' },
  { key: 'over90', label: '90+ Days' },
];

export const AgedReceivablesPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['aged-receivables'],
    queryFn: accountingApi.getAgedReceivables,
  });

  const columns = [
    { title: 'Invoice No.', dataIndex: 'invoiceNo', key: 'invoiceNo' },
    { title: 'Customer', dataIndex: 'customer', key: 'customer' },
    { title: 'Invoice Date', dataIndex: 'invoiceDate', key: 'invoiceDate', render: (v: string) => formatDate(v) },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', render: (v: string) => formatDate(v) },
    {
      title: 'Days Overdue',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? <Tag color={v > 90 ? 'red' : v > 30 ? 'orange' : 'gold'}>{v}d</Tag> : <Tag>Current</Tag>),
    },
    {
      title: 'Outstanding (KES)',
      dataIndex: 'outstanding',
      key: 'outstanding',
      align: 'right' as const,
      render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4} style={{ margin: 0 }}>Aged Receivables</Title>

      <Row gutter={16}>
        <Col span={24 / (BUCKETS.length + 1)}>
          <Card>
            <Statistic
              title="Total Outstanding"
              value={data?.totalOutstanding || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        {BUCKETS.map((b) => (
          <Col key={b.key} span={24 / (BUCKETS.length + 1)}>
            <Card>
              <Statistic
                title={b.label}
                value={data?.summary?.[b.key as keyof typeof data.summary] || 0}
                formatter={(v) => formatCurrency(Number(v))}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.rows || []}
          rowKey="invoiceNo"
          loading={isLoading}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={5}><Text strong>TOTAL OUTSTANDING</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#f5222d' }}>{formatCurrency(data?.totalOutstanding || 0)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </Space>
  );
};
