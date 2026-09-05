import React from 'react';
import { Card, Col, InputNumber, Row, Space, Switch, Typography } from 'antd';
import { BellOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import type { SettingsOutletContext } from './SettingsPage';

const { Title, Text } = Typography;

export const GeneralSettingsPage: React.FC = () => {
  const { draft, updateDraft } = useOutletContext<SettingsOutletContext>();

  if (!draft) {
    return null;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4} style={{ margin: 0 }}>General Preferences</Title>
        <Text type="secondary">Control approval flows, alerts, and receipt display defaults.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space>
                <BellOutlined style={{ fontSize: 18, color: '#6f67ff' }} />
                <Title level={5} style={{ margin: 0 }}>Operational Alerts</Title>
              </Space>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Email notifications</Text>
                  <div><Text type="secondary">Send notifications for approvals, errors, and workflow events.</Text></div>
                </div>
                <Switch
                  checked={draft.emailNotifications}
                  onChange={(value) => updateDraft({ emailNotifications: value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Low stock alerts</Text>
                  <div><Text type="secondary">Highlight products that have reached their reorder threshold.</Text></div>
                </div>
                <Switch
                  checked={draft.showLowStockAlerts}
                  onChange={(value) => updateDraft({ showLowStockAlerts: value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Low stock threshold</Text>
                  <div><Text type="secondary">Send a notification when stock falls at or below this quantity.</Text></div>
                </div>
                <InputNumber
                  min={1}
                  max={10000}
                  value={draft.lowStockThreshold}
                  onChange={(value) => updateDraft({ lowStockThreshold: value ?? 5 })}
                  style={{ width: 90 }}
                  addonAfter="units"
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space>
                <CheckCircleOutlined style={{ fontSize: 18, color: '#1db8a0' }} />
                <Title level={5} style={{ margin: 0 }}>Workflow Defaults</Title>
              </Space>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Auto approve drafts</Text>
                  <div><Text type="secondary">Allow ready records to move from draft to approved automatically.</Text></div>
                </div>
                <Switch
                  checked={draft.autoApproveDrafts}
                  onChange={(value) => updateDraft({ autoApproveDrafts: value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>POS receipt branding</Text>
                  <div><Text type="secondary">Show company branding, PIN, address, and slogan on POS receipts.</Text></div>
                </div>
                <Switch
                  checked={draft.posReceiptBranding}
                  onChange={(value) => updateDraft({ posReceiptBranding: value })}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 22 }}>
        <Space direction="vertical" size="small">
          <Space>
            <FileTextOutlined style={{ color: '#d48806' }} />
            <Text strong>Current effect</Text>
          </Space>
          <Text type="secondary">
            Changes saved here immediately affect receipt branding usage in POS and the default operational preferences across the interface.
          </Text>
        </Space>
      </Card>
    </Space>
  );
};
