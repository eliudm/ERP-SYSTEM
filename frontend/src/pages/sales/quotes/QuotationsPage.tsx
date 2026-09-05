import React, { useState } from 'react';
import {
  Button, Card, Input, Select, Space, Table, Tag, Typography,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { salesApi } from '../../../api/sales.api';
import { formatCurrency } from '../../../utils/format';
import type { Quote, QuoteStatus } from '../../../types';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLOR: Record<QuoteStatus, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  ACCEPTED: 'green',
  DECLINED: 'red',
  EXPIRED: 'orange',
};

export const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', page, statusFilter],
    queryFn: () => salesApi.getQuotes(page, 20, statusFilter),
  });

  const filtered = (data?.data ?? []).filter((q) => {
    if (!search.trim()) return true;
    const hay = `${q.quoteNumber} ${q.customer?.name ?? ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const columns = [
    {
      title: 'Reference',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      render: (v: string, record: Quote) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/sales/quotes/${record.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, r: Quote) => r.customer?.name ?? '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Expiration',
      dataIndex: 'validUntil',
      key: 'validUntil',
      render: (v?: string) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: QuoteStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Quotations / Sales Orders</Title>
          <Text type="secondary">Create and manage quotes, send to customers, confirm as sales orders.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/sales/quotes/new')}
        >
          New Quotation
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: 22 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by reference or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="All Statuses"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="DRAFT">Draft</Option>
            <Option value="SENT">Sent</Option>
            <Option value="ACCEPTED">Accepted</Option>
            <Option value="DECLINED">Declined</Option>
            <Option value="EXPIRED">Expired</Option>
          </Select>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          onRow={(record) => ({ onClick: () => navigate(`/sales/quotes/${record.id}`) })}
          rowClassName={() => 'clickable-row'}
          pagination={{
            current: page,
            total: data?.meta?.total ?? 0,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} quotations`,
          }}
        />
      </Card>
    </Space>
  );
};
