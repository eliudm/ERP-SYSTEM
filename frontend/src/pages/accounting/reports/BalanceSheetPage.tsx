import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Button, Statistic, Row, Col, Alert,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency } from '../../../utils/format';

const { Title, Text } = Typography;

const amountColumns = (color: string) => [
  { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
  { title: 'Account', dataIndex: 'name', key: 'name' },
  {
    title: 'Amount (KES)',
    dataIndex: 'balance',
    key: 'balance',
    align: 'right' as const,
    render: (v: number) => <Text style={{ color }}>{formatCurrency(v)}</Text>,
  },
];

export const BalanceSheetPage: React.FC = () => {
  const [asOf, setAsOf] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['balance-sheet', asOf],
    queryFn: () => accountingApi.getBalanceSheet(asOf),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Balance Sheet</Title>
        <Space>
          <DatePicker
            defaultValue={dayjs()}
            onChange={(d) => d && setAsOf(d.format('YYYY-MM-DD'))}
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

      {data && (
        data.isBalanced ? (
          <Alert message="✅ Balance Sheet is Balanced" type="success" showIcon />
        ) : (
          <Alert
            message="⚠️ Assets do not equal Liabilities + Equity — please review journal entries"
            type="error"
            showIcon
          />
        )
      )}

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Assets"
              value={data?.assets?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Liabilities"
              value={data?.liabilities?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Equity"
              value={data?.equity?.total || 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Assets">
        <Table
          columns={amountColumns('#1677ff')}
          dataSource={data?.assets?.accounts || []}
          rowKey="code"
          loading={isLoading}
          pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total Assets</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#1677ff' }}>{formatCurrency(data?.assets?.total || 0)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Card title="Liabilities">
        <Table
          columns={amountColumns('#f5222d')}
          dataSource={data?.liabilities?.accounts || []}
          rowKey="code"
          loading={isLoading}
          pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total Liabilities</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#f5222d' }}>{formatCurrency(data?.liabilities?.total || 0)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Card title="Equity">
        <Table
          columns={amountColumns('#52c41a')}
          dataSource={data?.equity?.accounts || []}
          rowKey="code"
          loading={isLoading}
          pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text>Retained Earnings</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text>{formatCurrency(data?.equity?.retainedEarnings || 0)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total Equity</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#52c41a' }}>{formatCurrency(data?.equity?.total || 0)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </Space>
  );
};
