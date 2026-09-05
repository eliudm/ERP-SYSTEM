import React from 'react';
import { Button, Card, Col, Divider, Form, Input, InputNumber, Row, Space, Switch, Typography, message } from 'antd';
import {
  PrinterOutlined, ShopOutlined, BellOutlined, SaveOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { settingsApi } from '../../api/settings.api';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const POSConfigurationPage: React.FC = () => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        companyName: settings.companyName,
        companyPin: settings.companyPin ?? '',
        companyAddress: settings.companyAddress ?? '',
        receiptSlogan: settings.receiptSlogan ?? '',
        posReceiptBranding: settings.posReceiptBranding,
        showLowStockAlerts: settings.showLowStockAlerts,
        lowStockThreshold: settings.lowStockThreshold,
      });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      settingsApi.updateSystemSettings(values),
    onSuccess: () => {
      message.success('POS settings saved');
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: () => message.error('Failed to save settings'),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Configuration</Title>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveMutation.isPending}
          onClick={() => form.validateFields().then((v) => saveMutation.mutate(v))}
        >
          Save
        </Button>
      </div>

      <Form form={form} layout="vertical" disabled={isLoading}>
        <Row gutter={24}>
          {/* Receipt / Branding */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <PrinterOutlined />
                  Receipt Configuration
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 24 }}
            >
              <Form.Item label="Business Name (on receipt)" name="companyName" rules={[{ required: true }]}>
                <Input prefix={<ShopOutlined />} placeholder="Nexora ERP" />
              </Form.Item>
              <Form.Item label="KRA PIN" name="companyPin">
                <Input placeholder="P051234567X" />
              </Form.Item>
              <Form.Item label="Business Address" name="companyAddress">
                <TextArea rows={2} placeholder="Moi Avenue, Nairobi, Kenya" />
              </Form.Item>
              <Form.Item label="Receipt Footer / Slogan" name="receiptSlogan">
                <TextArea rows={2} placeholder="Thank you for your business!" />
              </Form.Item>
              <Form.Item
                label="Show branding on receipt"
                name="posReceiptBranding"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="On"
                  unCheckedChildren="Off"
                />
              </Form.Item>
            </Card>
          </Col>

          {/* Stock Alerts */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <BellOutlined />
                  Stock Alerts
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 24 }}
            >
              <Form.Item
                label="Enable low-stock warnings in POS"
                name="showLowStockAlerts"
                valuePropName="checked"
              >
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
              <Form.Item
                label="Low stock threshold (units)"
                name="lowStockThreshold"
                rules={[{ required: true, type: 'number', min: 0 }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>

              <Divider />

              <Text type="secondary" style={{ fontSize: 12 }}>
                To manage POS users, payment methods, or tax settings, visit the{' '}
                <a href="/settings/general">General Settings</a> page.
              </Text>
            </Card>
          </Col>
        </Row>
      </Form>
    </Space>
  );
};

export default POSConfigurationPage;
