import React, { useState } from 'react';
import {
  Table, Button, Card, Typography,
  Space, Tag, Modal, Form, Select,
  Input, message,
} from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accounting.api';

const { Title } = Typography;

export const AccountsPage: React.FC = () => {
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.getAccounts,
  });

  const seedMutation = useMutation({
    mutationFn: accountingApi.seedAccounts,
    onSuccess: (data) => {
      message.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: accountingApi.createAccount,
    onSuccess: () => {
      message.success('Account created');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create');
    },
  });

  const typeColors: Record<string, string> = {
    ASSET: 'blue',
    LIABILITY: 'red',
    EQUITY: 'purple',
    REVENUE: 'green',
    EXPENSE: 'orange',
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (
        <Tag color={typeColors[v]}>{v}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Chart of Accounts</Title>
        <Space>
          <Button
            icon={<SyncOutlined />}
            onClick={() => seedMutation.mutate()}
            loading={seedMutation.isPending}
          >
            Seed Default Accounts
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModal(true)}
          >
            New Account
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={accounts || []}
          rowKey="id"
          loading={isLoading}
        />
      </Card>

      <Modal
        title="New Account"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createMutation.mutate}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="code" label="Account Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. 1001" />
          </Form.Item>
          <Form.Item name="name" label="Account Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Petty Cash" />
          </Form.Item>
          <Form.Item name="type" label="Account Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ASSET', label: 'Asset' },
                { value: 'LIABILITY', label: 'Liability' },
                { value: 'EQUITY', label: 'Equity' },
                { value: 'REVENUE', label: 'Revenue' },
                { value: 'EXPENSE', label: 'Expense' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
