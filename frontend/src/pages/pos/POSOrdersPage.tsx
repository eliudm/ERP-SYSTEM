import React from 'react';
import { Badge, Button, Card, DatePicker, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import dayjs from 'dayjs';
import { salesApi } from '../../api/sales.api';
import { settingsApi } from '../../api/settings.api';
import { formatCurrency } from '../../utils/format';
import { buildReceiptHtml, openReceiptPrintWindow } from '../../utils/receiptHtml';
import type { Invoice, PaymentMethod } from '../../types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '../../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'blue',
  PAID: 'green',
  VOID: 'red',
  DRAFT: 'default',
};

export const POSOrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-orders', page, statusFilter],
    queryFn: () => salesApi.getInvoices(page, 20, statusFilter),
  });

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const invoices: Invoice[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;

  // Client-side search and date filter on the fetched page
  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.customer?.name?.toLowerCase().includes(q);
    const matchDate = !dateRange || (
      dayjs(inv.invoiceDate).isAfter(dateRange[0].startOf('day').subtract(1, 'ms')) &&
      dayjs(inv.invoiceDate).isBefore(dateRange[1].endOf('day').add(1, 'ms'))
    );
    return matchSearch && matchDate;
  });

  const columns = [
    {
      title: 'Order',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (v: string) => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, row: Invoice) => row.customer?.name ?? '—',
    },
    {
      title: 'Date',
      dataIndex: 'invoiceDate',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Payment',
      dataIndex: 'paymentMethod',
      key: 'payment',
      render: (v: PaymentMethod) =>
        v ? (
          <Tag>
            {PAYMENT_METHOD_ICONS[v]} {PAYMENT_METHOD_LABELS[v]}
          </Tag>
        ) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Badge status={v === 'PAID' ? 'success' : v === 'VOID' ? 'error' : 'processing'} text={<Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>} />,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(Number(v))}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, row: Invoice) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<PrinterOutlined />}
            title="Reprint receipt"
            onClick={() => handleReprint(row)}
          />
        </Space>
      ),
    },
  ];

  const handleReprint = (inv: Invoice) => {
    const html = buildReceiptHtml(
      {
        receiptNo: inv.invoiceNo,
        createdAt: inv.invoiceDate,
        customerName: inv.customer?.name ?? 'Walk-in Customer',
        customerPin: inv.customer?.taxPin ?? null,
        paymentMethod: inv.paymentMethod,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        total: Number(inv.total),
        items: (inv.items ?? []).map((item) => ({
          name: item.product?.name ?? '',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        qrCode: inv.etimsInvoice?.qrCode ?? null,
        reprint: true,
        businessName: settings?.companyName || 'Nexora ERP',
        businessLogo: settings?.companyLogo ?? null,
        businessAddress: settings?.companyAddress ?? null,
        businessPin: settings?.companyPin ?? null,
        businessSlogan: settings?.receiptSlogan ?? null,
        showBranding: settings?.posReceiptBranding ?? true,
      },
      settings?.receiptTemplate,
    );
    openReceiptPrintWindow(html);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Orders</Title>
      </div>

      {/* Filters */}
      <Card bordered={false} style={{ borderRadius: 12, padding: 0 }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search order # or customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'APPROVED', label: 'Approved' },
              { value: 'PAID', label: 'Paid' },
              { value: 'VOID', label: 'Void' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            style={{ width: 260 }}
          />
        </Space>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `${t} orders`,
          }}
          size="middle"
        />
      </Card>
    </Space>
  );
};

export default POSOrdersPage;
