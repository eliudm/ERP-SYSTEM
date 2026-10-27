import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Select, Button, Statistic, Row, Col, Empty,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate } from '../../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface LedgerLine {
  date: string;
  reference: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export const GeneralLedgerPage: React.FC = () => {
  const [accountId, setAccountId] = useState<string>();
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.getAccounts,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['general-ledger', accountId, dates],
    queryFn: () => accountingApi.getGeneralLedger(accountId!, dates[0], dates[1]),
    enabled: !!accountId,
  });

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => formatDate(v) },
    { title: 'Reference', dataIndex: 'reference', key: 'reference' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Debit (KES)', dataIndex: 'debit', key: 'debit', align: 'right' as const,
      render: (v: number) => (v > 0 ? formatCurrency(v) : '—'),
    },
    {
      title: 'Credit (KES)', dataIndex: 'credit', key: 'credit', align: 'right' as const,
      render: (v: number) => (v > 0 ? formatCurrency(v) : '—'),
    },
    {
      title: 'Running Balance (KES)', dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v >= 0 ? '#1677ff' : '#f5222d' }}>{formatCurrency(Math.abs(v))}</Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>General Ledger</Title>
        <Space>
          <Select
            placeholder="Select an account"
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            value={accountId}
            onChange={setAccountId}
            options={(accounts || []).map((a) => ({
              value: a.id,
              label: `${a.code} — ${a.name}`,
            }))}
          />
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
            disabled={!accountId}
          >
            Generate
          </Button>
        </Space>
      </div>

      {!accountId ? (
        <Card>
          <Empty description="Select an account to view its ledger" />
        </Card>
      ) : (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Opening Balance"
                  value={data?.openingBalance || 0}
                  formatter={(v) => formatCurrency(Number(v))}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Closing Balance"
                  value={data?.closingBalance || 0}
                  formatter={(v) => formatCurrency(Number(v))}
                  valueStyle={{ color: (data?.closingBalance || 0) >= 0 ? '#1677ff' : '#f5222d' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Entries" value={data?.lines?.length || 0} />
              </Card>
            </Col>
          </Row>

          <Card
            title={data?.account ? `${data.account.code} — ${data.account.name}` : undefined}
          >
            <Table<LedgerLine>
              columns={columns}
              dataSource={data?.lines || []}
              rowKey={(r, i) => `${r.date}-${r.reference}-${i}`}
              loading={isLoading}
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </>
      )}
    </Space>
  );
};
