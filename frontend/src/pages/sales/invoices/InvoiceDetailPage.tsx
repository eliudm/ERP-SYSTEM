import React, { useState } from 'react';
import {
  Card, Typography, Tag, Space, Button, Table, Descriptions,
  Modal, Input, message, Spin, Empty, Popconfirm, Divider,
} from 'antd';
import {
  ArrowLeftOutlined, PrinterOutlined, CheckOutlined,
  DollarOutlined, StopOutlined, RollbackOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { salesApi } from '../../../api/sales.api';
import { settingsApi } from '../../../api/settings.api';
import { openReceiptPrintWindow } from '../../../utils/receiptHtml';
import { buildInvoiceDocumentHtml } from '../../../utils/invoiceDocumentHtml';
import { formatCurrency, formatDate, getStatusColor } from '../../../utils/format';
import { useAuthStore } from '../../../store/auth.store';
import type { InvoiceItem, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '../../../types';

const { Title, Text } = Typography;

const ETIMS_COLORS: Record<string, string> = {
  SUCCESS: 'green',
  SUBMITTED: 'blue',
  PENDING: 'gold',
  FAILED: 'red',
};

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<PaymentMethod>('CASH');
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => salesApi.getInvoice(id!),
    enabled: !!id,
  });

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => salesApi.approveInvoice(id!),
    onSuccess: () => { message.success('Invoice approved and posted to accounting'); invalidate(); },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed to approve'),
  });

  const paidMutation = useMutation({
    mutationFn: (paymentMethod: PaymentMethod) => salesApi.markAsPaid(id!, paymentMethod),
    onSuccess: () => { message.success('Invoice marked as paid'); setPayModalOpen(false); invalidate(); },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed to mark as paid'),
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) => salesApi.voidInvoice(id!, reason),
    onSuccess: () => { message.success('Invoice voided'); setVoidModalOpen(false); invalidate(); },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed to void'),
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('Invoice not loaded');
      const creditNote = await salesApi.createCreditNote({
        customerId: invoice.customer.id,
        invoiceId: invoice.id,
        reason: 'Sales invoice refund',
        items: invoice.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        })),
      });
      const canApprove = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
      if (canApprove) {
        await salesApi.approveCreditNote(creditNote.id);
      }
      return canApprove;
    },
    onSuccess: (approved) => {
      message.success(
        approved
          ? 'Refund approved — stock restored.'
          : 'Refund submitted — pending manager approval.',
      );
      invalidate();
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed to submit refund'),
  });

  const handlePrint = () => {
    if (!invoice) return;
    const html = buildInvoiceDocumentHtml({
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate ?? null,
      status: invoice.status,
      customerName: invoice.customer?.name ?? 'Walk-in Customer',
      customerAddress: invoice.customer?.address ?? null,
      customerPin: invoice.customer?.taxPin ?? null,
      paymentMethod: invoice.paymentMethod,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      items: invoice.items.map((item) => ({
        name: item.product?.name ?? item.description ?? '',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        amount: Number(item.lineTotal),
      })),
      notes: invoice.notes ?? null,
      companyName: settings?.companyName || 'Nexora ERP',
      companyLogo: settings?.companyLogo ?? null,
      companyAddress: settings?.companyAddress ?? null,
      companyPin: settings?.companyPin ?? null,
      companySlogan: settings?.receiptSlogan ?? null,
    });
    openReceiptPrintWindow(html);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!invoice) {
    return <Empty description="Invoice not found" style={{ marginTop: 80 }} />;
  }

  const existingCreditNote = invoice.creditNotes?.[0];
  const alreadyRefunded = existingCreditNote && ['APPROVED', 'APPLIED'].includes(existingCreditNote.status);
  const refundPending = existingCreditNote?.status === 'DRAFT';
  const canRefund = invoice.status !== 'VOID' && !alreadyRefunded && !refundPending;

  const columns = [
    { title: 'Item', key: 'name', render: (_: unknown, row: InvoiceItem) => row.product?.name ?? row.description ?? '—' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (v: number) => Number(v) },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Tax', dataIndex: 'taxAmount', key: 'taxAmount', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Line Total', dataIndex: 'lineTotal', key: 'lineTotal', align: 'right' as const, render: (v: number) => <Text strong>{formatCurrency(Number(v))}</Text> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/invoices')} />
          <Title level={3} style={{ margin: 0 }}>{invoice.invoiceNo}</Title>
          <Tag color={getStatusColor(invoice.status)}>{invoice.status}</Tag>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
          {invoice.status === 'DRAFT' && (
            <Button type="primary" icon={<CheckOutlined />} loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              Approve
            </Button>
          )}
          {invoice.status === 'APPROVED' && (
            <Button type="primary" icon={<DollarOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => { setSelectedPayMethod('CASH'); setPayModalOpen(true); }}>
              Mark as Paid
            </Button>
          )}
          {['DRAFT', 'APPROVED'].includes(invoice.status) && (
            <Button danger icon={<StopOutlined />} onClick={() => setVoidModalOpen(true)}>Void</Button>
          )}
          {canRefund && (
            <Popconfirm
              title="Refund this invoice?"
              description={
                user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'
                  ? 'This creates a credit note for the full order and restores stock immediately.'
                  : 'This creates a credit note for the full order, which a manager must approve before stock is restored.'
              }
              okText="Confirm Refund"
              okButtonProps={{ danger: true, loading: refundMutation.isPending }}
              onConfirm={() => refundMutation.mutate()}
            >
              <Button danger icon={<RollbackOutlined />}>Refund</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {alreadyRefunded && existingCreditNote && (
        <Card bordered={false} style={{ background: '#fffbe6', borderRadius: 12 }}>
          Refunded via credit note <Text strong>{existingCreditNote.creditNoteNumber}</Text>
        </Card>
      )}
      {refundPending && existingCreditNote && (
        <Card bordered={false} style={{ background: '#fffbe6', borderRadius: 12 }}>
          Refund <Text strong>{existingCreditNote.creditNoteNumber}</Text> pending manager approval
        </Card>
      )}

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Customer">{invoice.customer?.name ?? 'Walk-in Customer'}</Descriptions.Item>
          <Descriptions.Item label="Invoice Date">{formatDate(invoice.invoiceDate)}</Descriptions.Item>
          <Descriptions.Item label="Due Date">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</Descriptions.Item>
          <Descriptions.Item label="Payment Method">
            {invoice.paymentMethod ? <Tag>{PAYMENT_METHOD_ICONS[invoice.paymentMethod]} {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}</Tag> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Paid At">{invoice.paidAt ? formatDate(invoice.paidAt) : '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table columns={columns} dataSource={invoice.items} rowKey="id" pagination={false} size="small" />
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space direction="vertical" align="end" style={{ minWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Text type="secondary">Subtotal</Text>
              <Text>{formatCurrency(Number(invoice.subtotal))}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Text type="secondary">VAT</Text>
              <Text>{formatCurrency(Number(invoice.taxAmount))}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
              <Text strong>Total</Text>
              <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{formatCurrency(Number(invoice.total))}</Text>
            </div>
          </Space>
        </div>
      </Card>

      <Card title="KRA / eTIMS Status" bordered={false} style={{ borderRadius: 12 }}>
        {invoice.etimsInvoice ? (
          <Space align="start" size="large">
            <Space direction="vertical">
              <Tag color={ETIMS_COLORS[invoice.etimsInvoice.status] ?? 'default'}>{invoice.etimsInvoice.status}</Tag>
              {invoice.etimsInvoice.etimsInvoiceNo && (
                <Text>eTIMS Invoice No: <Text strong>{invoice.etimsInvoice.etimsInvoiceNo}</Text></Text>
              )}
            </Space>
            {invoice.etimsInvoice.qrCode && (
              <img src={invoice.etimsInvoice.qrCode} alt="eTIMS QR code" style={{ width: 110, height: 110 }} />
            )}
          </Space>
        ) : (
          <Text type="secondary">Not yet submitted to eTIMS.</Text>
        )}
      </Card>

      <Modal
        title="Record Payment"
        open={payModalOpen}
        onCancel={() => setPayModalOpen(false)}
        onOk={() => paidMutation.mutate(selectedPayMethod)}
        confirmLoading={paidMutation.isPending}
        okText="Mark as Paid"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select payment method:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT'] as PaymentMethod[]).map((m) => (
              <Button key={m} type={selectedPayMethod === m ? 'primary' : 'default'} onClick={() => setSelectedPayMethod(m)}>
                {PAYMENT_METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
              </Button>
            ))}
          </div>
        </Space>
      </Modal>

      <Modal
        title="Void Invoice"
        open={voidModalOpen}
        onCancel={() => setVoidModalOpen(false)}
        onOk={() => voidMutation.mutate(voidReason)}
        okButtonProps={{ danger: true, loading: voidMutation.isPending }}
        okText="Void Invoice"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>Are you sure you want to void this invoice? This will reverse all accounting entries.</p>
          <Input.TextArea placeholder="Reason for voiding..." rows={3} onChange={(e) => setVoidReason(e.target.value)} />
        </Space>
      </Modal>
    </Space>
  );
};

export default InvoiceDetailPage;
