import React from 'react';
import { Card, Col, Input, Row, Space, Tag, Typography } from 'antd';
import { GlobalOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import type { SettingsOutletContext } from './SettingsPage';

const { Title, Text } = Typography;

export const LocalizationSettingsPage: React.FC = () => {
  const { draft, updateDraft } = useOutletContext<SettingsOutletContext>();

  if (!draft) {
    return null;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4} style={{ margin: 0 }}>Localization</Title>
        <Text type="secondary">Store the default language, timezone, and currency used across the system.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text type="secondary">Default Language</Text>
                <Input
                  value={draft.defaultLanguage}
                  onChange={(event) => updateDraft({ defaultLanguage: event.target.value })}
                  size="large"
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">Timezone</Text>
                <Input
                  value={draft.timezone}
                  onChange={(event) => updateDraft({ timezone: event.target.value })}
                  size="large"
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">Default Currency</Text>
                <Input
                  value={draft.defaultCurrency}
                  onChange={(event) => updateDraft({ defaultCurrency: event.target.value.toUpperCase() })}
                  size="large"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Space>
                <GlobalOutlined style={{ fontSize: 18, color: '#6f67ff' }} />
                <div>
                  <Text strong>{draft.defaultLanguage}</Text>
                  <div><Text type="secondary">Default language code</Text></div>
                </div>
              </Space>

              <Space>
                <ClockCircleOutlined style={{ fontSize: 18, color: '#1db8a0' }} />
                <div>
                  <Text strong>{draft.timezone}</Text>
                  <div><Text type="secondary">Timezone applied to system dates and reports</Text></div>
                </div>
              </Space>

              <div>
                <Text type="secondary">Currency Preview</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue" style={{ borderRadius: 999, padding: '4px 12px' }}>
                    {draft.defaultCurrency}
                  </Tag>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};
