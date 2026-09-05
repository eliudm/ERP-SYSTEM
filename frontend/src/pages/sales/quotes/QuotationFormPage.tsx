import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Button, Card, DatePicker, Divider, Form, Input, InputNumber,
  Popconfirm, Select, Space, Spin, Steps, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, DeleteOutlined, FileDoneOutlined,
  MailOutlined, PlusOutlined, PrinterOutlined, SaveOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';
import dayjs from 'dayjs';
import { salesApi } from '../../../api/sales.api';
import { inventoryApi } from '../../../api/inventory.api';
import { formatCurrency } from '../../../utils/format';
import type { Product, QuoteStatus } from '../../../types';
import { SendQuotationModal } from './SendQuotationModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ─── STATUS PIPELINE ───────────────────────────────────────
const PIPELINE: { key: QuoteStatus; label: string }[] = [
  { key: 'DRAFT', label: 'Quotation' },
  { key: 'SENT', label: 'Quotation Sent' },
  { key: 'ACCEPTED', label: 'Sales Order' },
];

const STATUS_STEP: Record<QuoteStatus, number> = {
  DRAFT: 0,
  SENT: 1,
  ACCEPTED: 2,
  DECLINED: 1,
  EXPIRED: 1,
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  ACCEPTED: 'green',
  DECLINED: 'red',
  EXPIRED: 'orange',
};

// ─── LINE ITEM TYPE ────────────────────────────────────────
interface LineItem {
  key: string;
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  leadTime: string;
  unitPrice: number;
  cost: number;
  discount: number;
  taxRate: number;
  margin: number;
  marginPct: number;
  taxAmount: number;
  lineTotal: number;
}

const emptyLine = (): LineItem => ({
  key: crypto.randomUUID(),
  productId: '',
  productName: '',
  description: '',
  quantity: 1,
  unit: 'pcs',
  leadTime: '',
  unitPrice: 0,
  cost: 0,
  discount: 0,
  taxRate: 0,
  margin: 0,
  marginPct: 0,
  taxAmount: 0,
  lineTotal: 0,
});

function calcLine(line: LineItem): LineItem {
  const discounted = line.unitPrice * (1 - line.discount / 100);
  const subtotal = discounted * line.quantity;
  const taxAmount = subtotal * (line.taxRate / 100);
  const lineTotal = subtotal + taxAmount;
  const cost = line.cost * line.quantity;
  const margin = subtotal - cost;
  const marginPct = subtotal > 0 ? (margin / subtotal) * 100 : 0;
  return { ...line, taxAmount, lineTotal, margin, marginPct };
}

// ─── MAIN COMPONENT ────────────────────────────────────────
export const QuotationFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form] = Form.useForm();
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [activeTab, setActiveTab] = useState('lines');
  const [dirty, setDirty] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // ── Load existing quote ──────────────────────────────────
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => salesApi.getQuote(id!),
    enabled: !isNew,
  });

  // ── Load customers ───────────────────────────────────────
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => salesApi.getCustomers(),
  });

  // ── Load products ────────────────────────────────────────
  const { data: products = [] } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => inventoryApi.getProducts(),
  });

  // ── Populate form when quote loads ──────────────────────
  useEffect(() => {
    if (quote) {
      form.setFieldsValue({
        customerId: quote.customerId,
        validUntil: quote.validUntil ? dayjs(quote.validUntil) : null,
        paymentTerms: 'Immediate',
        termsAndConditions: quote.notes ?? '',
      });
      if (quote.items?.length) {
        setLines(
          quote.items.map((item) => {
            const p = item.product;
            const base: LineItem = {
              key: item.id ?? crypto.randomUUID(),
              productId: item.productId,
              productName: p?.name ?? '',
              description: item.description ?? '',
              quantity: Number(item.quantity),
              unit: 'pcs',
              leadTime: '',
              unitPrice: Number(item.unitPrice),
              cost: Number(p?.unitPrice ?? 0) * 0.6, // placeholder cost
              discount: Number(item.discount),
              taxRate: Number(item.taxRate) * 100,
              margin: 0,
              marginPct: 0,
              taxAmount: Number(item.taxAmount),
              lineTotal: Number(item.lineTotal),
            };
            return calcLine(base);
          }),
        );
      }
    }
  }, [quote, form]);

  // ── Mutations ────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.createQuote>[0]) =>
      salesApi.createQuote(payload),
    onSuccess: (data) => {
      message.success('Quotation created');
      setDirty(false);
      navigate(`/sales/quotes/${data.id}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (e: unknown) => {
      const ae = e as AxiosError<{ message?: string }>;
      message.error(ae.response?.data?.message ?? 'Failed to save');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.updateQuote>[1]) =>
      salesApi.updateQuote(id!, payload),
    onSuccess: () => {
      message.success('Saved');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
    },
    onError: (e: unknown) => {
      const ae = e as AxiosError<{ message?: string }>;
      message.error(ae.response?.data?.message ?? 'Failed to save');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => salesApi.confirmQuote(id!),
    onSuccess: (invoice) => {
      message.success(`Sales Order confirmed — Invoice ${invoice.invoiceNo} created`);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate('/sales/quotes');
    },
    onError: (e: unknown) => {
      const ae = e as AxiosError<{ message?: string }>;
      message.error(ae.response?.data?.message ?? 'Failed');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => salesApi.declineQuote(id!),
    onSuccess: () => {
      message.success('Quotation declined');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
    },
    onError: (e: unknown) => {
      const ae = e as AxiosError<{ message?: string }>;
      message.error(ae.response?.data?.message ?? 'Failed');
    },
  });

  // ── Helpers ──────────────────────────────────────────────
  const updateLine = useCallback((key: string, field: keyof LineItem, value: unknown) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const updated = { ...l, [field]: value };
        if (field === 'productId') {
          const p = (products as Product[]).find((x) => x.id === value);
          if (p) {
            updated.productName = p.name;
            updated.unitPrice = Number(p.unitPrice);
            updated.taxRate = Number(p.taxRate) * 100;
            updated.cost = Number(p.unitPrice) * 0.6;
          }
        }
        return calcLine(updated);
      }),
    );
    setDirty(true);
  }, [products]);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const totals = lines.reduce(
    (acc, l) => {
      const subtotal = l.unitPrice * (1 - l.discount / 100) * l.quantity;
      acc.subtotal += subtotal;
      acc.tax += l.taxAmount;
      acc.total += l.lineTotal;
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 },
  );

  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      customerId: values.customerId,
      validUntil: values.validUntil ? values.validUntil.toISOString() : undefined,
      notes: values.termsAndConditions,
      items: lines
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          description: l.description || undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate / 100,
        })),
    };
  };

  const handleSave = () => {
    form.validateFields(['customerId']).then(() => {
      const payload = buildPayload();
      if (payload.items.length === 0) {
        message.warning('Add at least one product line');
        return;
      }
      if (isNew) {
        createMutation.mutate(payload);
      } else {
        updateMutation.mutate(payload);
      }
    });
  };

  const handlePrint = () => {
    if (!quote) return;
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(n);

    const itemRows = quote.items
      .map(
        (item, i) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td>${item.product?.name ?? item.description ?? ''}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">${fmt(Number(item.unitPrice))}</td>
          <td class="center">${(Number(item.taxRate) * 100).toFixed(0)}%</td>
          <td class="right">${fmt(Number(item.taxAmount))}</td>
          <td class="right">${fmt(Number(item.lineTotal))}</td>
        </tr>`,
      )
      .join('');

    const validUntil = quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('en-KE')
      : '—';
    const issueDate = new Date(quote.createdAt).toLocaleDateString('en-KE');
    const statusLabel: Record<string, string> = {
      DRAFT: 'Draft', SENT: 'Sent', ACCEPTED: 'Confirmed', DECLINED: 'Declined', EXPIRED: 'Expired',
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Quotation ${quote.quoteNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333; padding: 32px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .company { font-size: 22px; font-weight: 700; color: #1a237e; }
  .company small { display: block; font-size: 12px; font-weight: 400; color: #666; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-info .quote-no { font-size: 20px; font-weight: 700; color: #1a237e; }
  .doc-info .status { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #e3f2fd; color: #1565c0; margin-top: 4px; }
  .parties { display: flex; gap: 48px; margin-bottom: 28px; }
  .party h3 { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 6px; }
  .party p { line-height: 1.7; }
  .meta { display: flex; gap: 32px; background: #f5f7ff; border-radius: 8px; padding: 12px 20px; margin-bottom: 28px; }
  .meta-item label { font-size: 10px; text-transform: uppercase; color: #999; display: block; margin-bottom: 2px; }
  .meta-item span { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1a237e; color: #fff; }
  thead th { padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr.alt td { background: #fafafa; }
  .center { text-align: center; }
  .right { text-align: right; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { padding: 6px 12px; }
  .totals td:first-child { color: #666; }
  .totals td:last-child { text-align: right; font-weight: 600; }
  .totals tr.grand td { border-top: 2px solid #1a237e; font-size: 15px; color: #1a237e; font-weight: 700; padding-top: 10px; }
  .notes { margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
  .notes h4 { font-size: 11px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
  .footer { margin-top: 48px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  @media print {
    body { padding: 16px; }
    @page { margin: 15mm; size: A4; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="company">Nexora ERP<small>Your Business Management Solution</small></div>
    <div class="doc-info">
      <div class="quote-no">${quote.quoteNumber}</div>
      <div class="status">${statusLabel[quote.status] ?? quote.status}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Bill To</h3>
      <p>
        <strong>${quote.customer?.name ?? ''}</strong><br/>
        ${quote.customer?.email ? quote.customer.email + '<br/>' : ''}
        ${(quote.customer as any)?.phone ? (quote.customer as any).phone + '<br/>' : ''}
        ${(quote.customer as any)?.address ?? ''}
      </p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Issue Date</label><span>${issueDate}</span></div>
    <div class="meta-item"><label>Valid Until</label><span>${validUntil}</span></div>
    ${quote.notes ? `<div class="meta-item"><label>Reference</label><span>${quote.notes}</span></div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Product / Description</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="center">Tax %</th>
        <th class="right">Tax</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr><td>Untaxed Amount</td><td>${fmt(Number(quote.subtotal))}</td></tr>
      <tr><td>Taxes</td><td>${fmt(Number(quote.taxAmount))}</td></tr>
      <tr class="grand"><td>Total</td><td>${fmt(Number(quote.total))}</td></tr>
    </tbody>
  </table>

  ${quote.notes ? `<div class="notes"><h4>Terms &amp; Conditions</h4><p>${quote.notes}</p></div>` : ''}

  <div class="footer">Generated by Nexora ERP &mdash; ${new Date().toLocaleDateString('en-KE')}</div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const isDraft = !quote || quote.status === 'DRAFT';
  const isSent = quote?.status === 'SENT';
  const isAccepted = quote?.status === 'ACCEPTED';
  const isReadOnly = !isNew && !isDraft;
  const currentStatus: QuoteStatus = quote?.status ?? 'DRAFT';
  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    confirmMutation.isPending;

  // ── Columns ──────────────────────────────────────────────
  const lineColumns = [
    {
      title: 'Product Variant',
      key: 'product',
      width: 200,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{record.productName}</Text>
        ) : (
          <Select
            showSearch
            placeholder="Search product…"
            value={record.productId || undefined}
            style={{ width: '100%' }}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={(products as Product[]).map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onChange={(v) => updateLine(record.key, 'productId', v)}
          />
        ),
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: 90,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{record.quantity}</Text>
        ) : (
          <InputNumber
            min={0.01}
            value={record.quantity}
            style={{ width: '100%' }}
            onChange={(v) => updateLine(record.key, 'quantity', v ?? 1)}
          />
        ),
    },
    {
      title: 'Unit',
      key: 'unit',
      width: 70,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{record.unit}</Text>
        ) : (
          <Input
            value={record.unit}
            style={{ width: '100%' }}
            onChange={(e) => updateLine(record.key, 'unit', e.target.value)}
          />
        ),
    },
    {
      title: 'Lead Time',
      key: 'leadTime',
      width: 90,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{record.leadTime || '—'}</Text>
        ) : (
          <Input
            placeholder="e.g. 3 days"
            value={record.leadTime}
            style={{ width: '100%' }}
            onChange={(e) => updateLine(record.key, 'leadTime', e.target.value)}
          />
        ),
    },
    {
      title: 'Unit Price',
      key: 'unitPrice',
      width: 110,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{formatCurrency(record.unitPrice)}</Text>
        ) : (
          <InputNumber
            min={0}
            value={record.unitPrice}
            style={{ width: '100%' }}
            onChange={(v) => updateLine(record.key, 'unitPrice', v ?? 0)}
          />
        ),
    },
    {
      title: 'Cost',
      key: 'cost',
      width: 100,
      render: (_: unknown, record: LineItem) => (
        <Text type="secondary">{formatCurrency(record.cost * record.quantity)}</Text>
      ),
    },
    {
      title: 'Margin',
      key: 'margin',
      width: 90,
      render: (_: unknown, record: LineItem) => (
        <Text style={{ color: record.margin >= 0 ? '#3f8600' : '#cf1322' }}>
          {formatCurrency(record.margin)}
        </Text>
      ),
    },
    {
      title: 'Margin %',
      key: 'marginPct',
      width: 85,
      render: (_: unknown, record: LineItem) => (
        <Text style={{ color: record.marginPct >= 0 ? '#3f8600' : '#cf1322' }}>
          {record.marginPct.toFixed(1)}%
        </Text>
      ),
    },
    {
      title: 'Taxes',
      key: 'taxRate',
      width: 90,
      render: (_: unknown, record: LineItem) =>
        isReadOnly ? (
          <Text>{record.taxRate}%</Text>
        ) : (
          <InputNumber
            min={0}
            max={100}
            value={record.taxRate}
            style={{ width: '100%' }}
            formatter={(v) => `${v}%`}
            parser={(v) => Number(String(v).replace('%', '')) as 0}
            onChange={(v) => updateLine(record.key, 'taxRate', v ?? 0)}
          />
        ),
    },
    {
      title: 'Amount',
      key: 'lineTotal',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, record: LineItem) => (
        <Text strong>{formatCurrency(record.lineTotal)}</Text>
      ),
    },
    ...(!isReadOnly
      ? [
          {
            title: '',
            key: 'del',
            width: 40,
            render: (_: unknown, record: LineItem) => (
              <Tooltip title="Remove line">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeLine(record.key)}
                />
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  if (!isNew && isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      {/* ── TOP BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        {/* Left: breadcrumb + title */}
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate('/sales/quotes')}
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Quotations
            </Text>
            <Title level={4} style={{ margin: 0 }}>
              {isNew ? 'New' : quote?.quoteNumber}
              {!isNew && quote && (
                <Tag
                  color={STATUS_COLOR[currentStatus]}
                  style={{ marginLeft: 12, fontWeight: 400, fontSize: 12 }}
                >
                  {currentStatus}
                </Tag>
              )}
            </Title>
          </div>
        </Space>

        {/* Right: action buttons */}
        <Space>
          {(isNew || isDraft) && (
            <Button
              icon={<SaveOutlined />}
              loading={isBusy}
              onClick={handleSave}
              type={dirty ? 'primary' : 'default'}
            >
              {isNew ? 'Save' : 'Save'}
            </Button>
          )}
          {!isNew && isDraft && (
            <Button
              icon={<MailOutlined />}
              onClick={() => setSendModalOpen(true)}
            >
              Send
            </Button>
          )}
          {!isNew && isSent && (
            <Popconfirm
              title="Confirm as Sales Order?"
              description="This will create an invoice from this quotation."
              onConfirm={() => confirmMutation.mutate()}
              okText="Confirm"
            >
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={confirmMutation.isPending}
              >
                Confirm
              </Button>
            </Popconfirm>
          )}
          {!isNew && (isDraft || isSent) && (
            <Popconfirm
              title="Decline this quotation?"
              onConfirm={() => declineMutation.mutate()}
              okText="Decline"
              okButtonProps={{ danger: true }}
            >
              <Button danger type="text">
                Decline
              </Button>
            </Popconfirm>
          )}
          {!isNew && isAccepted && quote?.invoice && (
            <Button
              icon={<FileDoneOutlined />}
              onClick={() => navigate(`/sales/invoices`)}
            >
              View Invoice
            </Button>
          )}
          <Button icon={<PrinterOutlined />} type="text" onClick={handlePrint} disabled={isNew || !quote} />
        </Space>
      </div>

      {/* ── PIPELINE STEPS ── */}
      {!isNew && currentStatus !== 'DECLINED' && currentStatus !== 'EXPIRED' && (
        <Card
          size="small"
          bordered={false}
          style={{ borderRadius: 16, marginBottom: 16, background: 'rgba(255,255,255,0.7)' }}
        >
          <Steps
            current={STATUS_STEP[currentStatus]}
            size="small"
            items={PIPELINE.map((s) => ({ title: s.label }))}
            style={{ padding: '4px 16px' }}
          />
        </Card>
      )}
      {(currentStatus === 'DECLINED' || currentStatus === 'EXPIRED') && (
        <Alert
          type="warning"
          message={`This quotation has been ${currentStatus.toLowerCase()}.`}
          style={{ borderRadius: 12, marginBottom: 16 }}
          showIcon
        />
      )}

      {/* ── MAIN FORM CARD ── */}
      <Card bordered={false} style={{ borderRadius: 22 }}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
          initialValues={{ paymentTerms: 'Immediate' }}
        >
          {/* Header fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
            {/* Left */}
            <div>
              <Form.Item
                name="customerId"
                label="Customer"
                rules={[{ required: true, message: 'Select a customer' }]}
              >
                <Select
                  showSearch
                  disabled={isReadOnly}
                  placeholder="Type to find a customer…"
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </div>

            {/* Right: meta fields */}
            <div>
              <Form.Item name="validUntil" label="Expiration">
                <DatePicker
                  disabled={isReadOnly}
                  style={{ width: '100%' }}
                  format="DD MMM YYYY"
                />
              </Form.Item>
              <Form.Item name="pricelist" label="Pricelist">
                <Select disabled={isReadOnly} placeholder="Select pricelist…" allowClear>
                  <Option value="standard">Standard Price</Option>
                </Select>
              </Form.Item>
              <Form.Item name="paymentTerms" label="Payment Terms">
                <Select disabled={isReadOnly}>
                  <Option value="Immediate">Immediate</Option>
                  <Option value="Net 30">Net 30</Option>
                  <Option value="Net 60">Net 60</Option>
                </Select>
              </Form.Item>
            </div>
          </div>

          <Divider style={{ margin: '8px 0 16px' }} />

          {/* ── TABS ── */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'lines',
                label: 'Order Lines',
                children: (
                  <div>
                    <Table
                      dataSource={lines}
                      columns={lineColumns}
                      pagination={false}
                      size="small"
                      rowKey="key"
                      scroll={{ x: 'max-content' }}
                      style={{ marginBottom: 8 }}
                    />

                    {/* Add line actions */}
                    {!isReadOnly && (
                      <Space style={{ marginTop: 8 }} size="large">
                        <Button
                          type="link"
                          icon={<PlusOutlined />}
                          onClick={addLine}
                          style={{ paddingLeft: 0 }}
                        >
                          Add a product
                        </Button>
                        <Button
                          type="link"
                          onClick={() => {
                            const sectionLine: LineItem = {
                              ...emptyLine(),
                              description: 'Section',
                              productId: '__section__',
                              productName: '── Section ──',
                            };
                            setLines((prev) => [...prev, sectionLine]);
                          }}
                        >
                          Add a section
                        </Button>
                        <Button
                          type="link"
                          onClick={() => {
                            const noteLine: LineItem = {
                              ...emptyLine(),
                              productId: '__note__',
                              productName: '',
                              description: 'Note…',
                            };
                            setLines((prev) => [...prev, noteLine]);
                          }}
                        >
                          Add a note
                        </Button>
                      </Space>
                    )}

                    {/* Totals */}
                    <Divider style={{ margin: '16px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ minWidth: 280 }}>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                        >
                          <Text type="secondary">Untaxed Amount:</Text>
                          <Text strong>{formatCurrency(totals.subtotal)}</Text>
                        </div>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                        >
                          <Text type="secondary">Taxes:</Text>
                          <Text strong>{formatCurrency(totals.tax)}</Text>
                        </div>
                        <Divider style={{ margin: '8px 0' }} />
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between' }}
                        >
                          <Text strong style={{ fontSize: 16 }}>Total:</Text>
                          <Text strong style={{ fontSize: 16 }}>
                            {formatCurrency(totals.total)}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'other',
                label: 'Other Info',
                children: (
                  <div style={{ maxWidth: 600 }}>
                    <Form.Item name="termsAndConditions" label="Terms and Conditions">
                      <TextArea
                        rows={5}
                        disabled={isReadOnly}
                        placeholder="Terms and conditions…"
                      />
                    </Form.Item>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Card>

      {/* ── SEND QUOTATION MODAL ── */}
      {!isNew && quote && (
        <SendQuotationModal
          open={sendModalOpen}
          quoteId={quote.id}
          quoteNumber={quote.quoteNumber}
          customerName={(quote as any).customer?.name ?? ''}
          customerEmail={(quote as any).customer?.email ?? undefined}
          onClose={() => setSendModalOpen(false)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ['quote', id] });
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
          }}
        />
      )}
    </Space>
  );
};
