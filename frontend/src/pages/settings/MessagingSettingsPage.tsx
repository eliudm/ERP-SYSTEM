import React, { useEffect, useState } from 'react';
import {
  Card, Switch, Input, Button, Space, Typography, Alert, Form, Divider, message,
} from 'antd';
import { MessageOutlined, WhatsAppOutlined, ApiOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '../../api/messaging.api';

const { Title, Text, Paragraph } = Typography;

export const MessagingSettingsPage: React.FC = () => {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [waEnabled, setWaEnabled] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['messaging-settings'],
    queryFn: messagingApi.getSettings,
  });

  useEffect(() => {
    if (!settings) return;
    form.setFieldsValue({
      apiKey: settings.apiKey ?? '',
      username: settings.username ?? '',
      senderId: settings.senderId ?? '',
      whatsappNumber: settings.whatsappNumber ?? '',
    });
    setSmsEnabled(settings.smsEnabled);
    setWaEnabled(settings.whatsappEnabled);
  }, [settings, form]);

  const saveMut = useMutation({
    mutationFn: (vals: Record<string, string>) =>
      messagingApi.updateSettings({
        ...vals,
        smsEnabled,
        whatsappEnabled: waEnabled,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-settings'] });
      message.success('Messaging settings saved');
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Save failed'),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4} style={{ margin: 0 }}>Messaging</Title>
        <Text type="secondary">Configure Africa's Talking credentials for SMS and WhatsApp messaging.</Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Africa's Talking account required"
        description={
          <span>
            Sign up at <strong>africastalking.com</strong>, create an app, and copy the API key and username below.
            The same account supports both SMS and WhatsApp Business messaging.
          </span>
        }
      />

      <Card bordered={false} style={{ borderRadius: 22 }}>
        <Form form={form} layout="vertical" onFinish={(vals) => saveMut.mutate(vals)}>
          <Title level={5} style={{ marginTop: 0 }}><ApiOutlined /> API Credentials</Title>
          <Form.Item name="username" label="Africa's Talking Username" rules={[{ required: true }]}>
            <Input placeholder="sandbox (for testing) or your production username" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="Paste your API key (stored securely)" />
          </Form.Item>

          <Divider />

          <Title level={5}><MessageOutlined /> SMS Settings</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Switch checked={smsEnabled} onChange={setSmsEnabled} />
            <Text>Enable SMS sending</Text>
          </div>
          <Form.Item name="senderId" label="Sender ID / Shortcode (optional)">
            <Input placeholder="e.g. MYSHOP — leave blank to use default" style={{ maxWidth: 300 }} />
          </Form.Item>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
            Custom sender IDs must be registered with Africa's Talking and your telco. Leave blank to use the default shortcode.
          </Paragraph>

          <Divider />

          <Title level={5}><WhatsAppOutlined /> WhatsApp Settings</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Switch checked={waEnabled} onChange={setWaEnabled} />
            <Text>Enable WhatsApp Business messaging</Text>
          </div>
          <Form.Item name="whatsappNumber" label="WhatsApp Business Number">
            <Input placeholder="+254722000000" style={{ maxWidth: 300 }} />
          </Form.Item>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
            Must be a registered Africa's Talking WhatsApp Business number. Contact AT support to get one approved.
          </Paragraph>

          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saveMut.isPending || isLoading}
          >
            Save Settings
          </Button>
        </Form>
      </Card>
    </Space>
  );
};
