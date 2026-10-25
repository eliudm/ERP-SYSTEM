import React from 'react';
import { Card, Col, Row, Space, Typography, Tag, Empty, Skeleton, Alert } from 'antd';
import {
  WarningOutlined, ExclamationCircleOutlined, InfoCircleOutlined, BulbOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { aiInsightsApi, type Insight, type InsightSeverity } from '../../api/ai-insights.api';
import { formatDate } from '../../utils/format';

const { Title, Text, Paragraph } = Typography;

const SEVERITY_STYLE: Record<InsightSeverity, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
  critical: { bg: '#fff1f0', border: '#ffa39e', color: '#cf1322', icon: <ExclamationCircleOutlined />, label: 'Critical' },
  warning: { bg: '#fff7e6', border: '#ffd591', color: '#d46b08', icon: <WarningOutlined />, label: 'Warning' },
  info: { bg: '#e6f7ff', border: '#91d5ff', color: '#1677ff', icon: <InfoCircleOutlined />, label: 'Info' },
};

const TYPE_LABELS: Record<string, string> = {
  STOCK_ALERT: 'Stock',
  SALES_TREND: 'Sales',
  TOP_PRODUCTS: 'Products',
  PAYMENT_RISK: 'Payments',
  TOP_CUSTOMERS: 'Customers',
  DORMANT_CUSTOMERS: 'Customers',
};

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const style = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.info;

  return (
    <Card
      bordered={false}
      style={{ borderRadius: 12, background: style.bg, border: `1px solid ${style.border}`, height: '100%' }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Space align="start">
            <span style={{ color: style.color, fontSize: 18 }}>{style.icon}</span>
            <Text strong style={{ color: style.color }}>{style.label}</Text>
          </Space>
          {TYPE_LABELS[insight.type] && (
            <Tag color="default">{TYPE_LABELS[insight.type] ?? insight.type}</Tag>
          )}
        </div>
        <Title level={5} style={{ margin: 0 }}>{insight.title}</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>{insight.message}</Paragraph>
        {insight.entity?.code && (
          <Text type="secondary" style={{ fontSize: 12 }}>Ref: {insight.entity.code}</Text>
        )}
      </Space>
    </Card>
  );
};

export const AiInsightsPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => aiInsightsApi.getInsights(),
  });

  const insights = data?.insights ?? [];
  const severityOrder: InsightSeverity[] = ['critical', 'warning', 'info'];
  const sorted = [...insights].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space align="center">
          <BulbOutlined style={{ fontSize: 22, color: '#faad14' }} />
          <Title level={3} style={{ margin: 0 }}>AI Insights</Title>
        </Space>
        {data?.generatedAt && (
          <Text type="secondary">Generated {formatDate(data.generatedAt)}</Text>
        )}
      </div>

      {isError && (
        <Alert type="error" message="Could not load insights. Please try again later." showIcon />
      )}

      {isLoading && (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} md={12} key={i}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <Card bordered={false} style={{ borderRadius: 12 }}>
          <Empty description="No insights right now — everything looks healthy." />
        </Card>
      )}

      {!isLoading && sorted.length > 0 && (
        <Row gutter={[16, 16]}>
          {sorted.map((insight, i) => (
            <Col xs={24} md={12} key={`${insight.type}-${i}`}>
              <InsightCard insight={insight} />
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
};

export default AiInsightsPage;
