import React, { useState } from 'react';
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row,
  Space, Switch, Tag, Typography, message as antMessage, Tooltip,
} from 'antd';
import {
  SettingOutlined, GlobalOutlined, DeleteOutlined,
  ShopOutlined, LinkOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { pluginsApi, type Plugin } from '../../api/plugins.api';

const { Title, Text, Paragraph } = Typography;

// ─── Configure modal ──────────────────────────────────────────────────────────

const ConfigureModal: React.FC<{ plugin: Plugin | null; onClose: () => void }> = ({ plugin, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (plugin) {
      const fields: Record<string, any> = { version: plugin.version };
      if (plugin.config) Object.assign(fields, plugin.config);
      if (plugin.pageUrl) { fields.pageUrl = plugin.pageUrl; fields.pageLabel = plugin.pageLabel; }
      form.setFieldsValue(fields);
    }
  }, [plugin, form]);

  const mutation = useMutation({
    mutationFn: (values: any) => pluginsApi.updatePluginConfig(plugin!.id, {
      version: values.version,
      config: plugin!.pageUrl ? {} : Object.fromEntries(
        Object.entries(values).filter(([k]) => k !== 'version' && k !== 'pageUrl' && k !== 'pageLabel')
      ),
      ...(plugin!.pageUrl && { pageUrl: values.pageUrl, pageLabel: values.pageLabel }),
    }),
    onSuccess: () => { antMessage.success('Saved'); qc.invalidateQueries({ queryKey: ['plugins'] }); onClose(); },
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Error'),
  });

  const isPage = !!plugin?.pageUrl;

  return (
    <Modal
      title={`Configure — ${plugin?.name ?? ''}`}
      open={!!plugin}
      onCancel={onClose}
      onOk={() => form.validateFields().then((v) => mutation.mutate(v))}
      confirmLoading={mutation.isPending}
      okText="Save"
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item name="version" label="Version"><Input /></Form.Item>
        {isPage ? (
          <>
            <Form.Item name="pageUrl" label="Page URL" rules={[{ required: true }]}><Input prefix={<LinkOutlined />} /></Form.Item>
            <Form.Item name="pageLabel" label="Sidebar Label" rules={[{ required: true }]}><Input /></Form.Item>
          </>
        ) : (
          <Form.Item name="config" label="Config (JSON)">
            <Input.TextArea rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }}
              defaultValue={plugin?.config ? JSON.stringify(plugin.config, null, 2) : '{}'} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

// ─── Add custom page modal ────────────────────────────────────────────────────

const AddPageModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (values: any) => pluginsApi.registerPlugin({
      name: values.pageLabel || 'Custom Page',
      version: '1.0.0',
      category: 'Custom',
      description: 'Custom embedded page',
      author: 'Custom',
      config: {},
      pageUrl: values.pageUrl,
      pageLabel: values.pageLabel,
      pageIcon: 'GlobalOutlined',
    }),
    onSuccess: () => {
      antMessage.success('Custom page added');
      qc.invalidateQueries({ queryKey: ['plugins'] });
      form.resetFields();
      onClose();
    },
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Error'),
  });

  return (
    <Modal
      title={<Space><span style={{ fontSize: 20 }}>🖥️</span><span>Add Custom Page</span></Space>}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={() => form.validateFields().then((v) => mutation.mutate(v))}
      confirmLoading={mutation.isPending}
      okText="Add"
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Embed any external web app as a full page inside the sidebar navigation.
      </Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="pageUrl" label="Page URL" rules={[{ required: true, type: 'url', message: 'Enter a valid URL' }]}>
          <Input prefix={<LinkOutlined />} placeholder="https://mytool.example.com" />
        </Form.Item>
        <Form.Item name="pageLabel" label="Sidebar Label" rules={[{ required: true }]}>
          <Input placeholder="My Tool" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Installed plugin card ────────────────────────────────────────────────────

const InstalledCard: React.FC<{ plugin: Plugin; onConfigure: (p: Plugin) => void }> = ({ plugin, onConfigure }) => {
  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: () => plugin.status === 'ACTIVE' ? pluginsApi.deactivatePlugin(plugin.id) : pluginsApi.activatePlugin(plugin.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Error'),
  });

  const uninstallMut = useMutation({
    mutationFn: () => pluginsApi.uninstallPlugin(plugin.id),
    onSuccess: () => { antMessage.success('Removed'); qc.invalidateQueries({ queryKey: ['plugins'] }); },
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Error'),
  });

  const logo = plugin.pageUrl ? '🖥️' : plugin.category === 'E-commerce' ? '🛍️' :
    plugin.category === 'Accounting' ? '📊' : plugin.category === 'Payments' ? '💳' :
    plugin.category === 'Communication' ? '✉️' : plugin.category === 'Logistics' ? '📦' : '🔌';

  return (
    <Card size="small" style={{ borderColor: plugin.status === 'ACTIVE' ? '#1677ff' : undefined }}
      styles={{ body: { padding: '14px 16px' } }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{logo}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Space size={6}>
              <Text strong style={{ fontSize: 14 }}>{plugin.pageLabel || plugin.name}</Text>
              <Tag color="default" style={{ fontSize: 11, margin: 0 }}>{plugin.category}</Tag>
              {plugin.status === 'ACTIVE'
                ? <Tag color="green" style={{ margin: 0 }}>Active</Tag>
                : <Tag style={{ margin: 0 }}>Inactive</Tag>}
            </Space>
            <Switch checked={plugin.status === 'ACTIVE'} onChange={() => toggleMut.mutate()}
              loading={toggleMut.isPending} size="small" />
          </div>
          {plugin.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>{plugin.description}</Text>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Button size="small" icon={<SettingOutlined />} onClick={() => onConfigure(plugin)}>Configure</Button>
            {plugin.websiteUrl && (
              <Tooltip title={plugin.websiteUrl}>
                <Button size="small" icon={<GlobalOutlined />} href={plugin.websiteUrl} target="_blank" />
              </Tooltip>
            )}
            <Popconfirm title="Remove this plugin?" description="All configuration will be lost."
              onConfirm={() => uninstallMut.mutate()} okText="Remove" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} loading={uninstallMut.isPending} />
            </Popconfirm>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const PluginsPage: React.FC = () => {
  const navigate = useNavigate();
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [addPageOpen, setAddPageOpen] = useState(false);

  const { data: installed = [], isLoading } = useQuery<Plugin[]>({
    queryKey: ['plugins'],
    queryFn: () => pluginsApi.getPlugins(),
  });

  const activeCount = installed.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div style={{ padding: '0 4px' }}>
      <ConfigureModal plugin={configPlugin} onClose={() => setConfigPlugin(null)} />
      <AddPageModal open={addPageOpen} onClose={() => setAddPageOpen(false)} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Installed Plugins</Title>
          <Text type="secondary">
            {installed.length} installed · {activeCount} active
          </Text>
        </div>
        <Space>
          <Button icon={<LinkOutlined />} onClick={() => setAddPageOpen(true)}>
            Add Custom Page
          </Button>
          <Button type="primary" icon={<ShopOutlined />} onClick={() => navigate('/marketplace')}>
            Browse Marketplace
          </Button>
        </Space>
      </div>

      {/* Browse CTA when empty */}
      {!isLoading && installed.length === 0 && (
        <Card style={{ textAlign: 'center', borderStyle: 'dashed', background: '#fafafa' }}>
          <div style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <Title level={4} style={{ color: '#595959' }}>No plugins installed yet</Title>
            <Paragraph type="secondary" style={{ maxWidth: 400, margin: '0 auto 20px' }}>
              Extend your ERP with integrations, invoice templates, receipt designs, POS themes, and more from the Nexus Marketplace.
            </Paragraph>
            <Space>
              <Button type="primary" size="large" icon={<ShopOutlined />} onClick={() => navigate('/marketplace')}>
                Open Marketplace
              </Button>
              <Button size="large" icon={<PlusOutlined />} onClick={() => setAddPageOpen(true)}>
                Add Custom Page
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* Installed grid */}
      {installed.length > 0 && (
        <Row gutter={[16, 16]}>
          {installed.map((plugin) => (
            <Col xs={24} sm={12} lg={8} key={plugin.id}>
              <InstalledCard plugin={plugin} onConfigure={setConfigPlugin} />
            </Col>
          ))}
        </Row>
      )}

      {/* Always-visible browse nudge when items exist */}
      {installed.length > 0 && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button icon={<ShopOutlined />} onClick={() => navigate('/marketplace')}>
            Browse Marketplace for more apps, templates &amp; themes
          </Button>
        </div>
      )}
    </div>
  );
};

export default PluginsPage;
