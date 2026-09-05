import React, { useMemo, useState } from 'react';
import {
  Button, Card, Form, Input, Modal, Select, Space,
  Switch, Table, Tag, Typography, message,
} from 'antd';
import {
  TeamOutlined, StopOutlined, PlusOutlined,
  EditOutlined, KeyOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { authApi } from '../../api/auth.api';
import type { CreateUserPayload, UpdateUserPayload } from '../../api/auth.api';
import type { User } from '../../types';
import type { SettingsOutletContext } from './SettingsPage';

const { Title, Text } = Typography;
const { Option } = Select;

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'SALES_USER', label: 'Sales User' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer' },
];

export const UsersSettingsPage: React.FC = () => {
  const { search } = useOutletContext<SettingsOutletContext>();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const { data: users, isLoading } = useQuery({
    queryKey: ['settings-users'],
    queryFn: () => authApi.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => authApi.createUser(payload),
    onSuccess: () => {
      message.success('User created');
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setCreateOpen(false);
      createForm.resetFields();
    },
    onError: (error: unknown) => {
      const e = error as AxiosError<{ message?: string }>;
      message.error(e.response?.data?.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      authApi.updateUser(id, payload),
    onSuccess: () => {
      message.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setEditTarget(null);
    },
    onError: (error: unknown) => {
      const e = error as AxiosError<{ message?: string }>;
      message.error(e.response?.data?.message || 'Failed to update user');
    },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      authApi.resetPassword(id, newPassword),
    onSuccess: () => {
      message.success('Password reset successfully');
      setResetTarget(null);
      resetForm.resetFields();
    },
    onError: (error: unknown) => {
      const e = error as AxiosError<{ message?: string }>;
      message.error(e.response?.data?.message || 'Failed to reset password');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => authApi.deactivateUser(id),
    onSuccess: () => {
      message.success('User deactivated');
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
    onError: (error: unknown) => {
      const e = error as AxiosError<{ message?: string }>;
      message.error(e.response?.data?.message || 'Unable to deactivate user');
    },
  });

  const accessMutation = useMutation({
    mutationFn: ({ id, posOnly }: { id: string; posOnly: boolean }) =>
      authApi.updateUserAccess(id, posOnly),
    onSuccess: (_, variables) => {
      message.success(
        variables.posOnly ? 'User set to POS-only access' : 'User set to full module access',
      );
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
    onError: (error: unknown) => {
      const e = error as AxiosError<{ message?: string }>;
      message.error(e.response?.data?.message || 'Unable to update user access');
    },
  });

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return users || [];
    return (users || []).filter((user) => {
      const haystack = `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [search, users]);

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: unknown, record: User) => `${record.firstName} ${record.lastName}`,
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (value: string) => <Tag color="blue">{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'red'}>{value ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Access',
      key: 'access',
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Tag color={record.posOnly ? 'orange' : 'blue'}>
            {record.posOnly ? 'POS Only' : 'Full Access'}
          </Tag>
          <Switch
            checked={record.posOnly}
            checkedChildren="POS"
            unCheckedChildren="All"
            disabled={!record.isActive}
            loading={accessMutation.isPending && accessMutation.variables?.id === record.id}
            onChange={(checked) => accessMutation.mutate({ id: record.id, posOnly: checked })}
          />
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditTarget(record);
              editForm.setFieldsValue({
                firstName: record.firstName,
                lastName: record.lastName,
                role: record.role,
                posOnly: record.posOnly,
                isActive: record.isActive,
              });
            }}
          >
            Edit
          </Button>
          <Button
            type="link"
            icon={<KeyOutlined />}
            onClick={() => setResetTarget(record)}
          >
            Password
          </Button>
          <Button
            danger
            type="link"
            disabled={!record.isActive}
            loading={deactivateMutation.isPending}
            icon={<StopOutlined />}
            onClick={() => deactivateMutation.mutate(record.id)}
          >
            Deactivate
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4} style={{ margin: 0 }}>Users</Title>
        <Text type="secondary">
          Manage users and their access. POS-only users are restricted to the POS terminal.
        </Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 22 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <TeamOutlined style={{ fontSize: 18, color: '#6f67ff' }} />
              <Text strong>{filteredUsers.length} users visible</Text>
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setCreateOpen(true); createForm.resetFields(); }}
            >
              New User
            </Button>
          </Space>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredUsers}
            loading={isLoading}
            pagination={false}
          />
        </Space>
      </Card>

      {/* ── Create User Modal ── */}
      <Modal
        title="Create New User"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create User"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
          initialValues={{ role: 'SALES_USER', posOnly: false }}
        >
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="firstName" label="First Name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 12 }}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 12 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              {ROLES.map((r) => <Option key={r.value} value={r.value}>{r.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="posOnly" label="Access Type" valuePropName="checked">
            <Switch checkedChildren="POS Only" unCheckedChildren="Full Access" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        title={`Edit User — ${editTarget?.firstName} ${editTarget?.lastName}`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save Changes"
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editTarget) return;
            updateMutation.mutate({ id: editTarget.id, payload: values });
          }}
        >
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="firstName" label="First Name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 12 }}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 12 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              {ROLES.map((r) => <Option key={r.value} value={r.value}>{r.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="posOnly" label="Access Type" valuePropName="checked">
            <Switch checkedChildren="POS Only" unCheckedChildren="Full Access" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal
        title={`Reset Password — ${resetTarget?.firstName} ${resetTarget?.lastName}`}
        open={!!resetTarget}
        onCancel={() => { setResetTarget(null); resetForm.resetFields(); }}
        onOk={() => resetForm.submit()}
        confirmLoading={resetMutation.isPending}
        okText="Reset Password"
        destroyOnClose
      >
        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(values) => {
            if (!resetTarget) return;
            resetMutation.mutate({ id: resetTarget.id, newPassword: values.newPassword });
          }}
        >
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm Password"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
