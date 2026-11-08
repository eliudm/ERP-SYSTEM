import React, { useState } from 'react';
import {
  Alert, Button, Card, Descriptions, Divider, Drawer, Form, Input,
  InputNumber, Modal, Row, Col, Select, Space, Statistic, Table, Tag,
  Timeline, Typography,
} from 'antd';
import {
  CreditCardOutlined, DollarOutlined, UserOutlined, PhoneOutlined, MailOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { salesApi } from '../../api/sales.api';
import { formatCurrency, getStatusColor } from '../../utils/format';
import type { PaymentMethod } from '../../types';

const { Title, Text } = Typography;

type OutstandingInvoice = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  customer: { id: string; name: string; phone?: string } | null;
  total: number;
  amountPaid: number;
  balance: number;
};

export const POSCreditPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
  const [paymentForm] = Form.useForm();
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [customerDrawerId, setCustomerDrawerId] = useState<string | null>(null);

  const { data: outstanding = [], isLoading, error } = useQuery({
    queryKey: ['outstanding-credit'],
    queryFn: () => salesApi.getOutstandingCredit(),
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: customerStatement, isLoading: statementLoading } = useQuery({
    queryKey: ['customer-statement', customerDrawerId],
    queryFn: () => salesApi.getCustomerStatement(customerDrawerId!),
    enabled: !!customerDrawerId,
  });

  const { data: creditHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['credit-payments', selectedInvoice?.id],
    queryFn: () => salesApi.getCreditPayments(selectedInvoice!.id),
    enabled: !!selectedInvoice,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (dto: { amount: number; paymentMethod: PaymentMethod; notes?: string }) =>
      salesApi.recordCreditPayment(selectedInvoice!.id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-credit'] });
      queryClient.invalidateQueries({ queryKey: ['credit-payments', selectedInvoice?.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      paymentForm.resetFields();
      setPaymentAmount(null);
    },
  });

  const totalBalance = outstanding.reduce((s, inv) => s + inv.balance, 0);
  const totalInvoiced = outstanding.reduce((s, inv) => s + inv.total, 0);
  const totalCollected = outstanding.reduce((s, inv) => s + inv.amountPaid, 0);

  const openModal = (inv: OutstandingInvoice) => {
    setSelectedInvoice(inv);
    paymentForm.resetFields();
    setPaymentAmount(null);
  };

  const closeModal = () => {
    setSelectedInvoice(null);
    paymentForm.resetFields();
    setPaymentAmount(null);
  };

  // Live balance for modal — recompute from history if loaded
  const liveBalance = (() => {
    if (!selectedInvoice) return 0;
    const paid = (creditHistory ?? []).reduce((s, p) => s + Number(p.amount), 0);
    return selectedInvoice.total - paid;
  })();

  const columns = [
    {
      title: 'Invoice',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (v: string, row: OutstandingInvoice) => (
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
      title: 'Date',
      dataIndex: 'invoiceDate',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, row: OutstandingInvoice) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          {row.customer ? (
            <Button
              type="link"
              style={{ padding: 0, fontWeight: 600 }}
              onClick={(e) => { e.stopPropagation(); setCustomerDrawerId(row.customer!.id); }}
            >
              {row.customer.name}
            </Button>
          ) : (
            <Text>—</Text>
          )}
          {row.customer?.phone && <Text type="secondary" style={{ fontSize: 12 }}>· {row.customer.phone}</Text>}
        </Space>
      ),
    },
    {
      title: 'Invoice Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <Text>{formatCurrency(Number(v))}</Text>,
    },
    {
      title: 'Paid',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{formatCurrency(Number(v))}</Text>,
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: Number(v) > 0 ? '#cf1322' : '#52c41a' }}>
          {formatCurrency(Number(v))}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, row: OutstandingInvoice) => (
        <Button
          type="primary"
          size="small"
          icon={<DollarOutlined />}
          onClick={(e) => { e.stopPropagation(); openModal(row); }}
        >
          Pay
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space align="center">
          <CreditCardOutlined style={{ fontSize: 20, color: '#cf1322' }} />
          <Title level={3} style={{ margin: 0 }}>Credit Outstanding</Title>
        </Space>
        <Tag color="orange">{outstanding.length} unpaid {outstanding.length === 1 ? 'invoice' : 'invoices'}</Tag>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load credit invoices"
          description={(error as any)?.response?.data?.message || (error as Error)?.message || 'Unknown error'}
          style={{ marginBottom: 8 }}
        />
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16 }}>
        <Card bordered={false} style={{ flex: 1, borderRadius: 12 }}>
          <Statistic
            title="Total Outstanding"
            value={totalBalance}
            precision={2}
            prefix="KES"
            valueStyle={{ color: '#cf1322' }}
          />
        </Card>
        <Card bordered={false} style={{ flex: 1, borderRadius: 12 }}>
          <Statistic
            title="Total Invoiced"
            value={totalInvoiced}
            precision={2}
            prefix="KES"
          />
        </Card>
        <Card bordered={false} style={{ flex: 1, borderRadius: 12 }}>
          <Statistic
            title="Total Collected"
            value={totalCollected}
            precision={2}
            prefix="KES"
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </div>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={outstanding}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'No outstanding credit invoices' }}
          size="middle"
        />
      </Card>

      {/* Customer Statement Drawer */}
      <Drawer
        title={
          <Space>
            <UserOutlined />
            <span>{customerStatement?.customer?.name ?? 'Customer'}</span>
          </Space>
        }
        open={!!customerDrawerId}
        onClose={() => setCustomerDrawerId(null)}
        width={560}
        loading={statementLoading}
      >
        {customerStatement && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              {customerStatement.customer.phone && (
                <Space size={4}>
                  <PhoneOutlined style={{ color: '#8c8c8c' }} />
                  <Text type="secondary">{customerStatement.customer.phone}</Text>
                </Space>
              )}
              {customerStatement.customer.email && (
                <Space size={4}>
                  <MailOutlined style={{ color: '#8c8c8c' }} />
                  <Text type="secondary">{customerStatement.customer.email}</Text>
                </Space>
              )}
            </Space>

            <Row gutter={12} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <Card size="small" bordered={false} style={{ background: '#fafafa', borderRadius: 8 }}>
                  <Statistic
                    title="Total Billed"
                    value={customerStatement.summary.totalBilled}
                    precision={2}
                    prefix="KES"
                    valueStyle={{ fontSize: 15 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" bordered={false} style={{ background: '#f6ffed', borderRadius: 8 }}>
                  <Statistic
                    title="Collected"
                    value={customerStatement.summary.totalPaid}
                    precision={2}
                    prefix="KES"
                    valueStyle={{ color: '#52c41a', fontSize: 15 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" bordered={false} style={{ background: '#fff1f0', borderRadius: 8 }}>
                  <Statistic
                    title="Outstanding"
                    value={customerStatement.summary.outstandingBalance}
                    precision={2}
                    prefix="KES"
                    valueStyle={{ color: customerStatement.summary.outstandingBalance > 0 ? '#cf1322' : '#52c41a', fontSize: 15 }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider>Purchase History ({customerStatement.customer.invoices.length})</Divider>

            <Table
              size="small"
              rowKey="id"
              pagination={{ pageSize: 8, size: 'small' }}
              dataSource={customerStatement.customer.invoices}
              columns={[
                {
                  title: 'Invoice',
                  dataIndex: 'invoiceNo',
                  key: 'no',
                  render: (v: string, row: any) => (
                    <Button
                      type="link"
                      style={{ padding: 0, fontFamily: 'monospace', fontWeight: 600 }}
                      onClick={() => { setCustomerDrawerId(null); navigate(`/sales/invoices/${row.id}`); }}
                    >
                      {v}
                    </Button>
                  ),
                },
                {
                  title: 'Date',
                  dataIndex: 'invoiceDate',
                  key: 'date',
                  render: (v: string) => dayjs(v).format('DD MMM YYYY'),
                },
                {
                  title: 'Total',
                  dataIndex: 'total',
                  key: 'total',
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
                  title: 'Owes',
                  key: 'owes',
                  align: 'right' as const,
                  render: (_: unknown, row: any) => {
                    if (row.status === 'PAID') return <Text style={{ color: '#52c41a' }}>—</Text>;
                    const paid = (row.creditPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                    const bal = Number(row.total) - paid;
                    return bal > 0
                      ? <Text strong style={{ color: '#cf1322' }}>{formatCurrency(bal)}</Text>
                      : <Text style={{ color: '#52c41a' }}>Settled</Text>;
                  },
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* Payment modal */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined />
            <span>Record Payment — {selectedInvoice?.invoiceNo}</span>
          </Space>
        }
        open={!!selectedInvoice}
        onCancel={closeModal}
        footer={null}
        width={540}
        destroyOnClose
      >
        {selectedInvoice && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Customer">
                {selectedInvoice.customer?.name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Invoice Total">
                {formatCurrency(Number(selectedInvoice.total))}
              </Descriptions.Item>
              <Descriptions.Item label="Paid So Far">
                <Text style={{ color: '#52c41a' }}>
                  {formatCurrency(selectedInvoice.total - liveBalance)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Balance Due">
                <Text strong style={{ color: liveBalance > 0 ? '#cf1322' : '#52c41a' }}>
                  {formatCurrency(liveBalance)}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            {liveBalance <= 0 ? (
              <Alert type="success" showIcon message="This invoice is fully paid." style={{ marginBottom: 16 }} />
            ) : (
              <Form
                form={paymentForm}
                layout="vertical"
                onFinish={(vals) => recordPaymentMutation.mutate(vals)}
                initialValues={{ paymentMethod: 'CASH' }}
              >
                <Form.Item
                  name="amount"
                  label="Amount to Record"
                  rules={[
                    { required: true, message: 'Enter amount' },
                    { type: 'number', min: 0.01, message: 'Must be greater than 0' },
                    { type: 'number', max: liveBalance, message: `Cannot exceed balance of ${formatCurrency(liveBalance)}` },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    size="large"
                    min={0.01}
                    max={liveBalance}
                    precision={2}
                    placeholder={`Max ${formatCurrency(liveBalance)}`}
                    onChange={(v) => setPaymentAmount(v as number | null)}
                    addonAfter={
                      paymentAmount != null && paymentAmount >= liveBalance
                        ? <Tag color="green">Full Settlement</Tag>
                        : paymentAmount != null && paymentAmount > 0
                          ? <Tag color="orange">Partial</Tag>
                          : null
                    }
                  />
                </Form.Item>
                <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
                  <Select
                    size="large"
                    options={[
                      { value: 'CASH', label: 'Cash' },
                      { value: 'CARD', label: 'Card' },
                      { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                      { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="notes" label="Notes (optional)">
                  <Input.TextArea rows={2} placeholder="Reference number, remarks..." />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={recordPaymentMutation.isPending}
                  icon={<DollarOutlined />}
                >
                  Record Payment
                </Button>
              </Form>
            )}

            {(creditHistory ?? []).length > 0 && (
              <>
                <Divider>Payment History</Divider>
                <Timeline
                  loading={historyLoading}
                  items={(creditHistory ?? []).map((p) => ({
                    color: 'green',
                    children: (
                      <Space direction="vertical" size={0}>
                        <Text strong>{formatCurrency(Number(p.amount))}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {p.paymentMethod.replace('_', ' ')} · {dayjs(p.createdAt).format('DD MMM YYYY HH:mm')}
                          {p.recordedBy ? ` · ${p.recordedBy.firstName} ${p.recordedBy.lastName}` : ''}
                        </Text>
                        {p.notes && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{p.notes}</Text>
                        )}
                      </Space>
                    ),
                  }))}
                />
              </>
            )}
          </>
        )}
      </Modal>
    </Space>
  );
};

export default POSCreditPage;
