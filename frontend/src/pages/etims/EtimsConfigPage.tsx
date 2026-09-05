import React from 'react';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

export const EtimsConfigPage: React.FC = () => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>eTIMS Configuration</Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Connection">
            <Space direction="vertical" size="small">
              <Text>Environment: <Tag color="blue">SANDBOX</Tag></Text>
              <Text>Base URL: <Text code>http://localhost:3000/api/v1/etims</Text></Text>
              <Text type="secondary">Use backend .env to change sandbox/production settings.</Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Status">
            <Space direction="vertical" size="small">
              <Text>Invoice submissions are processed via queue workers.</Text>
              <Text type="secondary">You can monitor queue and failed submissions in backend eTIMS endpoints.</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};
