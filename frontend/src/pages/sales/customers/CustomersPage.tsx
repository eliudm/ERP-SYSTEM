import React, { useState } from 'react';
import {
  Table, Button, Card, Typography,
  Space, Input, Modal, Form, message, Tag,
  Row, Col, Statistic, Descriptions, Divider, Switch, InputNumber, Tooltip, Progress,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  HistoryOutlined, DollarOutlined, CreditCardOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../../../api/sales.api';
import { formatCurrency, formatDate, getStatusColor } from '../../../utils/format';
import type { Customer } from '../../../types';
import { useAuthStore } from '../../../store/auth.store';

const { Title, Text } = Typography;
const { Search } = Input;

export const CustomersPage: React.FC = () => {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing: Customer | null }>({ open: false, editing: null });
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => salesApi.getCustomers(search),
  });

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ['customer-statement', historyId],
    queryFn: () => salesApi.getCustomerStatement(historyId!),
    enabled: !!historyId,
  });

  const createMutation = useMutation({
    mutationFn: salesApi.createCustomer,
    onSuccess: () => {
      message.success('Customer created successfully');
      setModal({ open: false, editing: null });
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      salesApi.updateCustomer(id, data),
    onSuccess: () => {
      message.success('Customer updated');
      setModal({ open: false, editing: null });
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to update customer');
    },
  });

  const openEdit = (customer: Customer) => {
    form.setFieldsValue({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      taxPin: customer.taxPin,
      creditAllowed: customer.creditAllowed ?? false,
      creditLimit: customer.creditLimit ?? null,
    });
    setModal({ open: true, editing: customer });
  };

  const openCreate = () => {
    form.resetFields();
    setModal({ open: true, editing: null });
  };

  const handleSubmit = (values: Partial<Customer>) => {
    if (modal.editing) {
      updateMutation.mutate({ id: modal.editing.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = modal.editing ? updateMutation.isPending : createMutation.isPending;

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (v: string) => v || '—',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string) => v || '—',
    },
    {
      title: 'KRA PIN',
      dataIndex: 'taxPin',
      key: 'taxPin',
      render: (v: string) => v || '—',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Credit',
      key: 'credit',
      render: (_: any, record: Customer) => {
        if (!record.creditAllowed) return <Tag color="default">None</Tag>;
        return (
          <Tooltip title={record.creditLimit ? `Limit: ${formatCurrency(Number(record.creditLimit))}` : 'No limit set'}>
            <Tag color="blue" icon={<CreditCardOutlined />}>
              {record.creditLimit ? formatCurrency(Number(record.creditLimit)) : 'Unlimited'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Customer) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setHistoryId(record.id)}
          >
            History
          </Button>
        </Space>
      ),
    },
  ];

  const histCustomer = statement?.customer;
  const histSummary = statement?.summary;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Customers</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          New Customer
        </Button>
      </div>

      <Card>
        <Search
          placeholder="Search customers..."
          prefix={<SearchOutlined />}
          style={{ width: 300, marginBottom: 16 }}
          onSearch={setSearch}
          onChange={(e) => !e.target.value && setSearch('')}
        />

        <Table
          columns={columns}
          dataSource={customers || []}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={modal.editing ? `Edit — ${modal.editing.name}` : 'New Customer'}
        open={modal.open}
        onCancel={() => { setModal({ open: false, editing: null }); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={isPending}
        okText={modal.editing ? 'Save Changes' : 'Create Customer'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Customer name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
            <Input placeholder="Email address" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+254700000000" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Physical address" />
          </Form.Item>
          <Form.Item name="taxPin" label="KRA PIN">
            <Input placeholder="P123456789A" />
          </Form.Item>

          {isAdmin && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>Credit Settings</Divider>
              <Form.Item name="creditAllowed" label="Allow Credit Purchases" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.creditAllowed !== curr.creditAllowed}
              >
                {({ getFieldValue }) =>
                  getFieldValue('creditAllowed') ? (
                    <Form.Item
                      name="creditLimit"
                      label="Credit Limit"
                      tooltip="Maximum outstanding balance allowed. Leave blank for no limit."
                    >
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        placeholder="e.g. 50000"
                        prefix="KES"
                        formatter={(v) => v ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                        parser={(v) => Number((v || '').replace(/,/g, '')) as any}
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Purchase History Modal */}
      <Modal
        title={histCustomer ? `Purchase History — ${histCustomer.name}` : 'Purchase History'}
        open={!!historyId}
        onCancel={() => setHistoryId(null)}
        footer={<Button onClick={() => setHistoryId(null)}>Close</Button>}
        width={760}
        loading={statementLoading}
      >
        {histSummary && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Invoices" value={histSummary.totalInvoices} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Total Billed" value={formatCurrency(histSummary.totalBilled)} valueStyle={{ fontSize: 16 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Paid" value={formatCurrency(histSummary.totalPaid)} valueStyle={{ color: '#52c41a', fontSize: 16 }} prefix={<DollarOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Outstanding" value={formatCurrency(histSummary.outstandingBalance)} valueStyle={{ color: histSummary.outstandingBalance > 0 ? '#f5222d' : '#52c41a', fontSize: 16 }} />
                </Card>
              </Col>
            </Row>

            {histCustomer && (
              <Descriptions size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Phone">{histCustomer.phone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{histCustomer.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="KRA PIN">{histCustomer.taxPin || '—'}</Descriptions.Item>
                <Descriptions.Item label="Credit">
                  {(histCustomer as any).creditAllowed
                    ? ((histCustomer as any).creditLimit
                        ? <Tag color="blue">Limit: {formatCurrency(Number((histCustomer as any).creditLimit))}</Tag>
                        : <Tag color="blue">Unlimited</Tag>)
                    : <Tag color="default">Not allowed</Tag>}
                </Descriptions.Item>
              </Descriptions>
            )}
            {(histCustomer as any)?.creditAllowed && (histCustomer as any)?.creditLimit && histSummary.outstandingBalance > 0 && (
              <Card size="small" style={{ marginBottom: 16, borderColor: '#d4b106' }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  <CreditCardOutlined /> Credit Utilisation
                </Text>
                <Progress
                  percent={Math.min(100, Math.round((histSummary.outstandingBalance / Number((histCustomer as any).creditLimit)) * 100))}
                  strokeColor={histSummary.outstandingBalance > Number((histCustomer as any).creditLimit) * 0.9 ? '#f5222d' : '#1677ff'}
                  format={(p) => `${p}%`}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatCurrency(histSummary.outstandingBalance)} outstanding of {formatCurrency(Number((histCustomer as any).creditLimit))} limit
                </Text>
              </Card>
            )}

            <Divider>Invoice History</Divider>

            <Table
              size="small"
              rowKey="id"
              dataSource={histCustomer?.invoices || []}
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: 'Invoice No',
                  dataIndex: 'invoiceNo',
                  key: 'invoiceNo',
                  render: (v: string) => <Text code>{v}</Text>,
                },
                {
                  title: 'Date',
                  dataIndex: 'invoiceDate',
                  key: 'date',
                  render: (v: string) => formatDate(v),
                },
                {
                  title: 'Amount',
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
              ]}
            />
          </>
        )}
      </Modal>
    </Space>
  );
};

