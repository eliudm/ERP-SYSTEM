import React, { useEffect, useState } from 'react';
import {
  Avatar, Badge, Button, Card, Checkbox, DatePicker, Dropdown,
  Input, Select, Space, Table, Tag, Typography,
} from 'antd';
import { SearchOutlined, PrinterOutlined, EyeOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { salesApi } from '../../api/sales.api';
import { settingsApi } from '../../api/settings.api';
import { formatCurrency } from '../../utils/format';
import { buildReceiptHtml, openReceiptPrintWindow } from '../../utils/receiptHtml';
import type { Invoice } from '../../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'blue',
  PAID: 'green',
  VOID: 'red',
  DRAFT: 'default',
};

const ETIMS_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  SUBMITTED: 'processing',
  SUCCESS: 'green',
  FAILED: 'red',
};

// Which columns can be shown/hidden via the picker, and their display
// order — persisted per-device (no backend "user preference" concept
// exists in this app, same convention as useHeldOrders/useRegister).
const COLUMN_KEYS = [
  'invoiceNo', 'session', 'date', 'pointOfSale', 'receiptNo',
  'customer', 'cashier', 'total', 'profit', 'etimsStatus', 'status',
];
// Maps each column key to its i18n key (namespace-prefixed where it lives
// in a different namespace than 'pos').
const COLUMN_LABEL_KEYS: Record<string, string> = {
  invoiceNo: 'ordersPage.columns.orderRef',
  session: 'ordersPage.columns.session',
  date: 'common:date',
  pointOfSale: 'ordersPage.columns.pointOfSale',
  receiptNo: 'ordersPage.columns.receiptNo',
  customer: 'common:customer',
  cashier: 'ordersPage.columns.cashier',
  total: 'common:total',
  profit: 'ordersPage.columns.profit',
  etimsStatus: 'ordersPage.columns.etimsStatus',
  status: 'common:status',
};
const ALL_COLUMN_KEYS = COLUMN_KEYS;
const COLUMNS_STORAGE_KEY = 'nexora-orders-columns';

const loadVisibleColumns = (): string[] => {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return ALL_COLUMN_KEYS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
      return parsed;
    }
  } catch {
    // corrupt/old value — fall back to showing everything
  }
  return ALL_COLUMN_KEYS;
};

export const POSOrdersPage: React.FC = () => {
  const { t } = useTranslation('pos');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadVisibleColumns);

  useEffect(() => {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: ['pos-orders', page, statusFilter],
    queryFn: () => salesApi.getInvoices(page, 20, statusFilter),
  });

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const columnOptions = COLUMN_KEYS.map((key) => ({ key, label: t(COLUMN_LABEL_KEYS[key]) }));

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

  const allColumns = [
    {
      title: t('ordersPage.columns.orderRef'),
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (v: string, row: Invoice) => (
        <Button
          type="link"
          style={{ padding: 0, fontFamily: 'monospace', fontWeight: 600 }}
          onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${row.id}`); }}
        >
          {v}
        </Button>
      ),
    },
    {
      title: t('ordersPage.columns.session'),
      key: 'session',
      render: (_: unknown, row: Invoice) => row.posSession?.sessionRef ?? '—',
    },
    {
      title: t('common:date'),
      dataIndex: 'invoiceDate',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: t('ordersPage.columns.pointOfSale'),
      key: 'pointOfSale',
      // Prefer the session's branch (the cashier's own assigned outlet,
      // Settings > Users) since it's reliably set once a cashier has one —
      // fall back to the invoice's own branch (from the fulfilling
      // warehouse) for older sales or ones made outside a session.
      render: (_: unknown, row: Invoice) => row.posSession?.branch?.name ?? row.branch?.name ?? '—',
    },
    {
      title: t('ordersPage.columns.receiptNo'),
      key: 'receiptNo',
      // Government-assigned eTIMS number when KRA has accepted the
      // submission; otherwise fall back to our own invoice number so this
      // column always shows something, matching Odoo's own receipt column
      // (which is never blank — it's generated locally, not by the tax
      // authority).
      render: (_: unknown, row: Invoice) => row.etimsInvoice?.etimsInvoiceNo ?? row.invoiceNo,
    },
    {
      title: t('common:customer'),
      key: 'customer',
      render: (_: unknown, row: Invoice) => row.customer?.name ?? '—',
    },
    {
      title: t('ordersPage.columns.cashier'),
      key: 'cashier',
      render: (_: unknown, row: Invoice) =>
        row.cashier ? (
          <Space size={6}>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff22', color: '#1677ff' }} />
            <Text>{row.cashier.firstName}</Text>
          </Space>
        ) : '—',
    },
    {
      title: t('common:total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(Number(v))}</Text>,
    },
    {
      title: t('ordersPage.columns.profit'),
      key: 'profit',
      align: 'right' as const,
      // cogsAmount is only set once an invoice is approved — null means
      // "not computed yet" (e.g. a draft, or an older sale pending the
      // one-off COGS backfill), not a real zero.
      render: (_: unknown, row: Invoice) =>
        row.cogsAmount != null
          ? <Text style={{ color: '#52c41a' }}>{formatCurrency(Number(row.subtotal) - Number(row.cogsAmount))}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: t('ordersPage.columns.etimsStatus'),
      key: 'etimsStatus',
      render: (_: unknown, row: Invoice) =>
        row.etimsInvoice ? (
          <Tag color={ETIMS_STATUS_COLOR[row.etimsInvoice.status] ?? 'default'}>
            {row.etimsInvoice.status}
          </Tag>
        ) : <Tag>{t('ordersPage.notSent')}</Tag>,
    },
    {
      title: t('common:status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Badge status={v === 'PAID' ? 'success' : v === 'VOID' ? 'error' : 'processing'} text={<Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>} />,
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
            icon={<EyeOutlined />}
            title={t('ordersPage.viewParticulars')}
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${row.id}`); }}
          />
          <Button
            type="text"
            size="small"
            icon={<PrinterOutlined />}
            title={t('ordersPage.reprintReceipt')}
            onClick={(e) => { e.stopPropagation(); handleReprint(row); }}
          />
        </Space>
      ),
    },
  ];

  const columns = allColumns.filter(
    (col) => col.key === 'actions' || visibleColumns.includes(col.key),
  );

  const handleReprint = (inv: Invoice) => {
    const html = buildReceiptHtml(
      {
        receiptNo: inv.invoiceNo,
        createdAt: inv.invoiceDate,
        customerName: inv.customer?.name ?? t('common:walkInCustomer'),
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
        businessName: settings?.companyName || t('common:appName'),
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

  const columnPickerMenu = (
    <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {columnOptions.map((col) => (
          <Checkbox
            key={col.key}
            checked={visibleColumns.includes(col.key)}
            onChange={() => toggleColumn(col.key)}
          >
            {col.label}
          </Checkbox>
        ))}
      </Space>
    </div>
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Title level={3} style={{ margin: 0 }}>{t('ordersPage.title')}</Title>
          <Dropdown popupRender={() => columnPickerMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<SettingOutlined />} title={t('ordersPage.customizeColumns')} />
          </Dropdown>
        </Space>
      </div>

      {/* Filters */}
      <Card bordered={false} style={{ borderRadius: 12, padding: 0 }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('ordersPage.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder={t('ordersPage.statusPlaceholder')}
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'APPROVED', label: t('ordersPage.approved') },
              { value: 'PAID', label: t('ordersPage.paid') },
              { value: 'VOID', label: t('ordersPage.void') },
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
          scroll={{ x: 'max-content' }}
          onRow={(row) => ({
            onClick: () => navigate(`/sales/invoices/${row.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (totalCount) => t('ordersPage.ordersCount', { count: totalCount }),
          }}
          size="middle"
        />
      </Card>
    </Space>
  );
};

export default POSOrdersPage;
