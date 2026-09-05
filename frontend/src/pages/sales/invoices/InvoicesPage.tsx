import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Card,
  Typography, Input, Select, Modal,
  message, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined,
  CheckOutlined, DollarOutlined,
  StopOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { salesApi } from '../../../api/sales.api';
import { formatCurrency, formatDate, getStatusColor } from '../../../utils/format';
import type { Invoice, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '../../../types';

const { Title, Text } = Typography;
const { Search } = Input;

export const InvoicesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [voidModal, setVoidModal] = useState<{
    open: boolean; id: string;
  }>({ open: false, id: '' });
  const [voidReason, setVoidReason] = useState('');
  const [payModal, setPayModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [selectedPayMethod, setSelectedPayMethod] = useState<PaymentMethod>('CASH');

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn: () => salesApi.getInvoices(page, 20, status),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => salesApi.approveInvoice(id),
    onSuccess: () => {
      message.success('Invoice approved and posted to accounting');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to approve');
    },
  });

  const paidMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod: PaymentMethod }) =>
      salesApi.markAsPaid(id, paymentMethod),
    onSuccess: () => {
      message.success('Invoice marked as paid');
      setPayModal({ open: false, id: '' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to mark as paid');
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      salesApi.voidInvoice(id, reason),
    onSuccess: () => {
      message.success('Invoice voided');
      setVoidModal({ open: false, id: '' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to void');
    },
  });

  const columns = [
    {
      title: 'Invoice No',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (v: string, record: Invoice) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => navigate(`/sales/invoices/${record.id}`)}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: 'Date',
      dataIndex: 'invoiceDate',
      key: 'date',
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (v: string) => v ? formatDate(v) : '—',
    },
    {
      title: 'Amount',
      dataIndex: 'total',
      key: 'total',
      render: (v: number) => formatCurrency(Number(v)),
      align: 'right' as const,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Payment',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (v: PaymentMethod | undefined) =>
        v ? (
          <Tag>{PAYMENT_METHOD_ICONS[v]} {PAYMENT_METHOD_LABELS[v]}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Invoice) => (
        <Space>
          <Tooltip title="View">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/sales/invoices/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <Tooltip title="Approve">
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => approveMutation.mutate(record.id)}
                loading={approveMutation.isPending}
              />
            </Tooltip>
          )}
          {record.status === 'APPROVED' && (
            <Tooltip title="Mark as Paid">
              <Button
                size="small"
                type="primary"
                icon={<DollarOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => { setSelectedPayMethod('CASH'); setPayModal({ open: true, id: record.id }); }}
              />
            </Tooltip>
          )}
          {['DRAFT', 'APPROVED'].includes(record.status) && (
            <Tooltip title="Void">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() =>
                  setVoidModal({ open: true, id: record.id })
                }
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Sales Invoices</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/sales/invoices/new')}
        >
          New Invoice
        </Button>
      </div>

      <Card>
        {/* Filters */}
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="Search invoices..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Filter by status"
            style={{ width: 180 }}
            allowClear
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'PAID', label: 'Paid' },
              { value: 'VOID', label: 'Void' },
            ]}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: data?.meta.total || 0,
            pageSize: 20,
            onChange: setPage,
            showTotal: (total) => `${total} invoices`,
          }}
        />
      </Card>

      {/* Pay Modal */}
      <Modal
        title="Record Payment"
        open={payModal.open}
        onCancel={() => setPayModal({ open: false, id: '' })}
        onOk={() => paidMutation.mutate({ id: payModal.id, paymentMethod: selectedPayMethod })}
        confirmLoading={paidMutation.isPending}
        okText="Mark as Paid"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select payment method:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT'] as PaymentMethod[]).map((m) => (
              <Button
                key={m}
                type={selectedPayMethod === m ? 'primary' : 'default'}
                onClick={() => setSelectedPayMethod(m)}
              >
                {PAYMENT_METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
              </Button>
            ))}
          </div>
        </Space>
      </Modal>

      {/* Void Modal */}
      <Modal
        title="Void Invoice"
        open={voidModal.open}
        onCancel={() => setVoidModal({ open: false, id: '' })}
        onOk={() =>
          voidMutation.mutate({ id: voidModal.id, reason: voidReason })
        }
        okButtonProps={{ danger: true, loading: voidMutation.isPending }}
        okText="Void Invoice"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>Are you sure you want to void this invoice? This will reverse all accounting entries.</p>
          <Input.TextArea
            placeholder="Reason for voiding..."
            rows={3}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </Space>
      </Modal>
    </Space>
  );
};
