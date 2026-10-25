import React, { useEffect, useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, Select, message,
  Typography, Card, Switch, Popconfirm, Modal,
} from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pluginsApi } from '../../api/plugins.api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  entryPoint: string;
  config: Record<string, any> | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  installedAt: string;
  updatedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
};

// ─── Register plugin modal ───────────────────────────────────────────────────
const RegisterPluginModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const registerMutation = useMutation({
    mutationFn: (v: any) =>
      pluginsApi.registerPlugin({
        ...v,
        config: v.config ? JSON.parse(v.config) : undefined,
      }),
    onSuccess: () => {
      message.success('Plugin registered');
      qc.invalidateQueries({ queryKey: ['plugins'] });
      form.resetFields();
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const handleOk = () =>
    form.validateFields().then((values) => {
      try {
        if (values.config) JSON.parse(values.config);
      } catch {
        message.error('Config must be valid JSON');
        return;
      }
      registerMutation.mutate(values);
    });

  return (
    <Modal
      title="Register New Plugin"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={registerMutation.isPending}
      okText="Register"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. loyalty-rewards" />
        </Form.Item>
        <Form.Item name="version" label="Version" rules={[{ required: true, message: 'Version is required' }]}>
          <Input placeholder="e.g. 1.0.0" />
        </Form.Item>
        <Form.Item name="entryPoint" label="Entry Point" rules={[{ required: true, message: 'Entry point is required' }]}>
          <Input placeholder="e.g. plugins/loyalty-rewards/index.js" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="What this plugin does…" />
        </Form.Item>
        <Form.Item name="author" label="Author">
          <Input placeholder="e.g. Acme Corp" />
        </Form.Item>
        <Form.Item name="config" label="Initial Config (JSON)">
          <Input.TextArea rows={4} placeholder='e.g. { "apiKey": "…" }' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Configure plugin modal ──────────────────────────────────────────────────
const ConfigurePluginModal: React.FC<{ plugin: Plugin | null; onClose: () => void }> = ({ plugin, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  useEffect(() => {
    if (plugin) {
      form.setFieldsValue({
        version: plugin.version,
        config: plugin.config ? JSON.stringify(plugin.config, null, 2) : '{}',
      });
    }
  }, [plugin, form]);

  const updateMutation = useMutation({
    mutationFn: (v: any) =>
      pluginsApi.updatePluginConfig(plugin!.id, {
        version: v.version,
        config: v.config ? JSON.parse(v.config) : undefined,
      }),
    onSuccess: () => {
      message.success('Configuration updated');
      qc.invalidateQueries({ queryKey: ['plugins'] });
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const handleOk = () =>
    form.validateFields().then((values) => {
      try {
        if (values.config) JSON.parse(values.config);
      } catch {
        message.error('Config must be valid JSON');
        return;
      }
      updateMutation.mutate(values);
    });

  return (
    <Modal
      title={`Configure — ${plugin?.name ?? ''}`}
      open={!!plugin}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={updateMutation.isPending}
      okText="Save"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="version" label="Version">
          <Input placeholder="e.g. 1.0.1" />
        </Form.Item>
        <Form.Item name="config" label="Config (JSON)">
          <Input.TextArea rows={8} style={{ fontFamily: 'monospace' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const PluginsPage: React.FC = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [configuring, setConfiguring] = useState<Plugin | null>(null);

  const { data: plugins = [], isLoading } = useQuery<Plugin[]>({
    queryKey: ['plugins', statusFilter],
    queryFn: () => pluginsApi.getPlugins(statusFilter),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.activatePlugin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plugins'] }); message.success('Plugin activated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.deactivatePlugin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plugins'] }); message.success('Plugin deactivated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.uninstallPlugin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plugins'] }); message.success('Plugin uninstalled'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<Plugin> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v) => <Text strong>{v}</Text>,
    },
    { title: 'Version', dataIndex: 'version', key: 'version', render: (v) => <Text code>{v}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v) => v ?? '—' },
    { title: 'Author', dataIndex: 'author', key: 'author', render: (v) => v ?? '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Active',
      key: 'toggle',
      render: (_, r) => (
        <Switch
          checked={r.status === 'ACTIVE'}
          loading={activateMutation.isPending || deactivateMutation.isPending}
          onChange={(checked) =>
            checked ? activateMutation.mutate(r.id) : deactivateMutation.mutate(r.id)
          }
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<SettingOutlined />} onClick={() => setConfiguring(r)}>
            Configure
          </Button>
          <Popconfirm
            title="Uninstall this plugin?"
            description="This will permanently remove the plugin registration."
            onConfirm={() => uninstallMutation.mutate(r.id)}
            okText="Uninstall"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger>Uninstall</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Plugins</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterOpen(true)}>
          Register Plugin
        </Button>
      </div>

      <Space wrap>
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={plugins}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} plugins` }}
        />
      </Card>

      <RegisterPluginModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <ConfigurePluginModal plugin={configuring} onClose={() => setConfiguring(null)} />
    </Space>
  );
};

export default PluginsPage;
