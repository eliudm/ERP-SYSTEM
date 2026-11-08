import React, { useState } from 'react';
import {
  Card, Typography, Space, Table,
  DatePicker, Button, Statistic, Row, Col, Tag, Tooltip,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate } from '../../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type DayRow = {
  date: string;
  cash: number;
  card: number;
  mobileMoney: number;
  bankTransfer: number;
  creditSales: number;
  creditPayments: number;
  total: number;
};

const STAT_COLS: { key: keyof DayRow; label: string; color: string; tip: string }[] = [
  { key: 'cash',          label: 'Cash',             color: '#52c41a', tip: 'Direct cash sales' },
  { key: 'mobileMoney',   label: 'M-Pesa',           color: '#1677ff', tip: 'Mobile Money / STK / Till' },
  { key: 'card',          label: 'Card',             color: '#722ed1', tip: 'Card / POS terminal' },
  { key: 'bankTransfer',  label: 'Bank Transfer',    color: '#13c2c2', tip: 'EFT / RTGS / SWIFT' },
  { key: 'creditSales',   label: 'Credit Sales',     color: '#fa8c16', tip: 'Goods dispatched on credit — cash not yet collected' },
  { key: 'creditPayments',label: 'Credit Collected', color: '#eb2f96', tip: 'Cash received against previously outstanding credit invoices' },
];

const exportCsv = (rows: DayRow[]) => {
  const header = 'Date,Cash,M-Pesa,Card,Bank Transfer,Credit Sales,Credit Collected,Total';
  const lines = rows.map((r) =>
    [r.date, r.cash, r.mobileMoney, r.card, r.bankTransfer, r.creditSales, r.creditPayments, r.total].join(','),
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'daily-collections.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export const CashFlowPage: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['daily-collections', dates],
    queryFn: () => accountingApi.getDailyCollections(dates[0], dates[1]),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      fixed: 'left' as const,
      width: 110,
      render: (v: string) => <Text strong>{formatDate(v)}</Text>,
    },
    {
      title: <Tooltip title="Direct cash sales"><span style={{ color: '#52c41a' }}>💵 Cash</span></Tooltip>,
      dataIndex: 'cash',
      key: 'cash',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#52c41a' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="Mobile Money / STK / Till"><span style={{ color: '#1677ff' }}>📱 M-Pesa</span></Tooltip>,
      dataIndex: 'mobileMoney',
      key: 'mobileMoney',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#1677ff' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="Card / POS terminal"><span style={{ color: '#722ed1' }}>💳 Card</span></Tooltip>,
      dataIndex: 'card',
      key: 'card',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#722ed1' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="EFT / RTGS"><span style={{ color: '#13c2c2' }}>🏦 Bank</span></Tooltip>,
      dataIndex: 'bankTransfer',
      key: 'bankTransfer',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#13c2c2' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="Goods dispatched on credit"><span style={{ color: '#fa8c16' }}>📑 Credit Sales</span></Tooltip>,
      dataIndex: 'creditSales',
      key: 'creditSales',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#fa8c16' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="Cash collected on outstanding credit"><span style={{ color: '#eb2f96' }}>✅ Credit Collected</span></Tooltip>,
      dataIndex: 'creditPayments',
      key: 'creditPayments',
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#eb2f96' }}>{formatCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Daily Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      fixed: 'right' as const,
      width: 130,
      render: (v: number) => (
        <Text strong style={{ fontSize: 13 }}>{formatCurrency(v)}</Text>
      ),
    },
  ];

  const tableData: (DayRow & { key: string })[] = [
    ...rows.map((r) => ({ ...r, key: r.date })),
    ...(totals && rows.length > 0 ? [{
      key: '__totals__',
      date: 'TOTALS',
      cash: totals.cash,
      card: totals.card,
      mobileMoney: totals.mobileMoney,
      bankTransfer: totals.bankTransfer,
      creditSales: totals.creditSales,
      creditPayments: totals.creditPayments,
      total: totals.total,
    }] : []),
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Daily Cash Collections</Title>
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
            Run
          </Button>
          {rows.length > 0 && (
            <Button icon={<DownloadOutlined />} onClick={() => exportCsv(rows)}>
              Export CSV
            </Button>
          )}
        </Space>
      </div>

      {/* Summary stat cards */}
      <Row gutter={[12, 12]}>
        {STAT_COLS.map((col) => (
          <Col key={col.key} xs={12} sm={8} md={4}>
            <Tooltip title={col.tip}>
              <Card size="small" style={{ borderTop: `3px solid ${col.color}` }}>
                <Statistic
                  title={col.label}
                  value={totals ? totals[col.key as keyof typeof totals] : 0}
                  formatter={(v) => formatCurrency(Number(v))}
                  valueStyle={{ color: col.color, fontSize: 15 }}
                />
              </Card>
            </Tooltip>
          </Col>
        ))}
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderTop: '3px solid #262626', backgroundColor: '#fafafa' }}>
            <Statistic
              title="Grand Total"
              value={totals?.total ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ fontSize: 15, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Daily breakdown table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tableData}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 900 }}
          size="small"
          rowClassName={(r) => r.key === '__totals__' ? 'totals-row' : ''}
          locale={{ emptyText: 'No collections in selected period' }}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <style>{`
          .totals-row td { background: #f6f6f6 !important; font-weight: 700; border-top: 2px solid #e0e0e0; }
        `}</style>
      </Card>
    </Space>
  );
};
