import React from 'react';
import {
  Table, Card, Typography, Space,
  Tag, Alert, Statistic, Row, Col,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency } from '../../../utils/format';

const { Title, Text } = Typography;

export const TrialBalancePage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['trial-balance'],
    queryFn: accountingApi.getTrialBalance,
  });

  const typeColors: Record<string, string> = {
    ASSET: 'blue', LIABILITY: 'red',
    EQUITY: 'purple', REVENUE: 'green', EXPENSE: 'orange',
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Account Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={typeColors[v]}>{v}</Tag>,
    },
    {
      title: 'Debit (KES)',
      dataIndex: 'totalDebit',
      key: 'debit',
      align: 'right' as const,
      render: (v: number) => v > 0 ? formatCurrency(v) : '—',
    },
    {
      title: 'Credit (KES)',
      dataIndex: 'totalCredit',
      key: 'credit',
      align: 'right' as const,
      render: (v: number) => v > 0 ? formatCurrency(v) : '—',
    },
    {
      title: 'Balance (KES)',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => (
        <Text
          strong
          style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}
        >
          {formatCurrency(Math.abs(v))}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4} style={{ margin: 0 }}>Trial Balance</Title>

      {data?.totals && (
        <>
          {data.totals.isBalanced ? (
            <Alert
              message="✅ Trial Balance is Balanced"
              type="success"
              showIcon
            />
          ) : (
            <Alert
              message="⚠️ Trial Balance is NOT Balanced — Please review journal entries"
              type="error"
              showIcon
            />
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Debits"
                  value={data.totals.totalDebit}
                  formatter={(v) => formatCurrency(Number(v))}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Credits"
                  value={data.totals.totalCredit}
                  formatter={(v) => formatCurrency(Number(v))}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Difference"
                  value={Math.abs(
                    data.totals.totalDebit - data.totals.totalCredit,
                  )}
                  formatter={(v) => formatCurrency(Number(v))}
                  valueStyle={{
                    color: data.totals.isBalanced ? '#52c41a' : '#f5222d',
                  }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={data?.accounts || []}
          rowKey="code"
          loading={isLoading}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Text strong>TOTALS</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#1677ff' }}>
                    {formatCurrency(data?.totals?.totalDebit || 0)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong style={{ color: '#52c41a' }}>
                    {formatCurrency(data?.totals?.totalCredit || 0)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </Space>
  );
};
