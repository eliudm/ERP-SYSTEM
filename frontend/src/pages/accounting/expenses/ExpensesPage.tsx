import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Select, Tag, Modal, Form, Input, InputNumber,
  DatePicker, Switch, message, Popconfirm,
} from 'antd';
import { PlusOutlined, CheckOutlined, DollarOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate, getStatusColor } from '../../../utils/format';
import { PAYMENT_METHOD_LABELS } from '../../../types';
import type { Expense, PaymentMethod } from '../../../types';

const { Title, Text } = Typography;

// Expense "paid" always means money actually left an account — CREDIT
// (buy-now-pay-later) doesn't apply here, that's what the payable branch
// (no payment method yet) already represents.
const EXPENSE_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'];

interface CreateExpenseFormValues {
  date: dayjs.Dayjs;
  accountId: string;
  payee: string;
  amount: number;
  description?: string;
  notes?: string;
}

interface SettleFormValues {
  alreadyPaid?: boolean;
  cashAccountId?: string;
  paymentMethod?: PaymentMethod;
}

export const ExpensesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [createModal, setCreateModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Expense | null>(null);
  const [payTarget, setPayTarget] = useState<Expense | null>(null);
  const [createForm] = Form.useForm<CreateExpenseFormValues>();
  const [approveForm] = Form.useForm<SettleFormValues>();
  const [payForm] = Form.useForm<SettleFormValues>();
  const [approveAlreadyPaid, setApproveAlreadyPaid] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, statusFilter],
    queryFn: () => accountingApi.getExpenses(page, 20, statusFilter),
  });

  const { data: expenseAccounts } = useQuery({
    queryKey: ['accounts-by-type', 'EXPENSE'],
    queryFn: () => accountingApi.getAccountsByType('EXPENSE'),
  });

  const { data: cashAccounts } = useQuery({
    queryKey: ['accounts-by-type', 'ASSET'],
    queryFn: () => accountingApi.getAccountsByType('ASSET'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  const createMutation = useMutation({
    mutationFn: accountingApi.createExpense,
    onSuccess: () => {
      message.success('Expense recorded');
      setCreateModal(false);
      createForm.resetFields();
      invalidate();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to record expense');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SettleFormValues }) =>
      accountingApi.approveExpense(id, data),
    onSuccess: () => {
      message.success('Expense approved');
      setApproveTarget(null);
      approveForm.resetFields();
      setApproveAlreadyPaid(false);
      invalidate();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to approve expense');
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SettleFormValues }) =>
      accountingApi.payExpense(id, { cashAccountId: data.cashAccountId!, paymentMethod: data.paymentMethod }),
    onSuccess: () => {
      message.success('Expense paid');
      setPayTarget(null);
      payForm.resetFields();
      invalidate();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to pay expense');
    },
  });

  const voidMutation = useMutation({
    mutationFn: accountingApi.voidExpense,
    onSuccess: () => {
      message.success('Expense voided');
      invalidate();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to void expense');
    },
  });

  const accountOptions = (expenseAccounts || []).map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));
  const cashAccountOptions = (cashAccounts || []).map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));
  const paymentMethodOptions = EXPENSE_PAYMENT_METHODS.map((m) => ({
    value: m,
    label: PAYMENT_METHOD_LABELS[m],
  }));

  const handleCreateSubmit = (values: CreateExpenseFormValues) => {
    createMutation.mutate({
      date: values.date.format('YYYY-MM-DD'),
      accountId: values.accountId,
      payee: values.payee,
      amount: values.amount,
      description: values.description,
      notes: values.notes,
    });
  };

  const openApprove = (expense: Expense) => {
    setApproveTarget(expense);
    setApproveAlreadyPaid(false);
    approveForm.resetFields();
  };

  const handleApproveSubmit = (values: SettleFormValues) => {
    if (!approveTarget) return;
    approveMutation.mutate({ id: approveTarget.id, data: { ...values, alreadyPaid: approveAlreadyPaid } });
  };

  const openPay = (expense: Expense) => {
    setPayTarget(expense);
    payForm.resetFields();
  };

  const handlePaySubmit = (values: SettleFormValues) => {
    if (!payTarget) return;
    payMutation.mutate({ id: payTarget.id, data: values });
  };

  const columns = [
    { title: 'Expense No', dataIndex: 'expenseNo', key: 'expenseNo', render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => formatDate(v) },
    {
      title: 'Category',
      key: 'category',
      render: (_: unknown, row: Expense) => `${row.account?.code} — ${row.account?.name}`,
    },
    { title: 'Payee', dataIndex: 'payee', key: 'payee' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => formatCurrency(Number(v)),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, row: Expense) => (
        <Space size={4}>
          {row.status === 'DRAFT' && (
            <>
              <Button size="small" icon={<CheckOutlined />} onClick={() => openApprove(row)}>
                Approve
              </Button>
              <Popconfirm title="Void this expense?" onConfirm={() => voidMutation.mutate(row.id)}>
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            </>
          )}
          {row.status === 'APPROVED' && (
            <>
              <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => openPay(row)}>
                Pay
              </Button>
              <Popconfirm title="Void this expense?" onConfirm={() => voidMutation.mutate(row.id)}>
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Expenses</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          New Expense
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder="Filter by status..."
            style={{ width: 200 }}
            allowClear
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'APPROVED', label: 'Approved (payable)' },
              { value: 'PAID', label: 'Paid' },
              { value: 'VOID', label: 'Void' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: data?.meta?.total || 0,
            pageSize: 20,
            onChange: setPage,
            showTotal: (total) => `${total} expenses`,
          }}
        />
      </Card>

      {/* Create modal */}
      <Modal
        title="New Expense"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Record"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{ date: dayjs() }}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="accountId" label="Category" rules={[{ required: true }]}>
            <Select
              placeholder="Select expense category..."
              options={accountOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="payee" label="Payee" rules={[{ required: true }]}>
            <Input placeholder="e.g. Kenya Power, Landlord - John Doe" />
          </Form.Item>
          <Form.Item name="amount" label="Amount (KES)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="What was this for?" />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Approve modal */}
      <Modal
        title={`Approve ${approveTarget?.expenseNo ?? ''}`}
        open={!!approveTarget}
        onCancel={() => { setApproveTarget(null); setApproveAlreadyPaid(false); approveForm.resetFields(); }}
        onOk={() => approveForm.submit()}
        confirmLoading={approveMutation.isPending}
        okText="Approve"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Already paid?</Text>
            <Switch checked={approveAlreadyPaid} onChange={setApproveAlreadyPaid} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {approveAlreadyPaid
              ? 'Posts straight to Paid — money already left the account below.'
              : 'Posts as owed on Accounts Payable; you\'ll settle it later with a separate payment.'}
          </Text>

          <Form form={approveForm} layout="vertical" onFinish={handleApproveSubmit}>
            {approveAlreadyPaid && (
              <>
                <Form.Item
                  name="cashAccountId"
                  label="Paid from"
                  rules={[{ required: approveAlreadyPaid, message: 'Select which account the money came from' }]}
                >
                  <Select placeholder="Select cash/bank account..." options={cashAccountOptions} />
                </Form.Item>
                <Form.Item name="paymentMethod" label="Payment Method">
                  <Select placeholder="Select payment method..." options={paymentMethodOptions} />
                </Form.Item>
              </>
            )}
          </Form>
        </Space>
      </Modal>

      {/* Pay modal (settling a payable expense) */}
      <Modal
        title={`Pay ${payTarget?.expenseNo ?? ''}`}
        open={!!payTarget}
        onCancel={() => { setPayTarget(null); payForm.resetFields(); }}
        onOk={() => payForm.submit()}
        confirmLoading={payMutation.isPending}
        okText="Pay"
      >
        <Form form={payForm} layout="vertical" onFinish={handlePaySubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="cashAccountId"
            label="Paid from"
            rules={[{ required: true, message: 'Select which account the money came from' }]}
          >
            <Select placeholder="Select cash/bank account..." options={cashAccountOptions} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method">
            <Select placeholder="Select payment method..." options={paymentMethodOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default ExpensesPage;
