import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Button, Statistic, Row, Col, Divider,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency } from '../../../utils/format';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ProfitLossPage: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    `${dayjs().year()}-01-01`,
    `${dayjs().year()}-12-31`,
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pnl', dates],
    queryFn: () => accountingApi.getProfitAndLoss(dates[0], dates[1]),
  });

  const revenueColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Account', dataIndex: 'name', key: 'name' },
    {
      title: 'Amount (KES)',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: '#52c41a' }}>{formatCurrency(v)}</Text>
      ),
    },
  ];

  const expenseColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Account', dataIndex: 'name', key: 'name' },
    {
      title: 'Amount (KES)',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: '#f5222d' }}>{formatCurrency(v)}</Text>
      ),
    },
  ];

  const pbt = data?.profitBeforeTax || 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Profit & Loss Statement</Title>
        <Space>
          <RangePicker
            defaultValue={[dayjs().startOf('year'), dayjs().endOf('year')]}
            onChange={(_, strings) => {
              if (strings[0] && strings[1]) {
                setDates([strings[0], strings[1]]);
              }
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

      {/* Summary Cards */}
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={data?.revenue?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Expenses"
              value={data?.expenses?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Profit Before Tax"
              value={pbt}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: pbt >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Revenue */}
      <Card
        title={
          <Space>
            <Text strong>Revenue</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data?.period?.startDate} to {data?.period?.endDate}
            </Text>
          </Space>
        }
      >
        <Table
          columns={revenueColumns}
          dataSource={data?.revenue?.accounts || []}
          rowKey="code"
          loading={isLoading}
          pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>Total Revenue</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#52c41a' }}>
                    {formatCurrency(data?.revenue?.total || 0)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* Expenses */}
      <Card title="Expenses">
        <Table
          columns={expenseColumns}
          dataSource={data?.expenses?.accounts || []}
          rowKey="code"
          loading={isLoading}
          pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>Total Expenses</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#f5222d' }}>
                    {formatCurrency(data?.expenses?.total || 0)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        <Divider />

        {/* Net Result */}
        <div
          style={{
            background: pbt >= 0 ? '#f6ffed' : '#fff2f0',
            border: `1px solid ${pbt >= 0 ? '#b7eb8f' : '#ffccc7'}`,
            borderRadius: 8,
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            {pbt >= 0 ? '✅ Net Profit' : '❌ Net Loss'}
          </Text>
          <Text
            strong
            style={{
              fontSize: 20,
              color: pbt >= 0 ? '#52c41a' : '#f5222d',
            }}
          >
            {formatCurrency(Math.abs(pbt))}
          </Text>
        </div>
      </Card>
    </Space>
  );
};
