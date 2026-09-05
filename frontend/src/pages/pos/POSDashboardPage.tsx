import React from 'react';
import { Alert, Button, Card, Col, Dropdown, Form, Input, Modal, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import {
  CalendarOutlined, DollarOutlined, EllipsisOutlined,
  LockOutlined, PlayCircleOutlined, PlusOutlined, ShoppingCartOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import dayjs from 'dayjs';
import { salesApi } from '../../api/sales.api';
import { settingsApi } from '../../api/settings.api';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

export const POSDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPosVerified = useAuthStore((s) => s.setPosVerified);
  const posLastClosedDate = useAuthStore((s) => s.posLastClosedDate);
  const today = dayjs().format('YYYY-MM-DD');

  // Work out the query window: from day after last close (or 30 days back) up to today
  const queryFrom = posLastClosedDate
    ? dayjs(posLastClosedDate).add(1, 'day').format('YYYY-MM-DD')
    : dayjs().subtract(30, 'day').format('YYYY-MM-DD');

  // Days since last close (null = never closed)
  const daysSinceClose = posLastClosedDate
    ? dayjs(today).diff(dayjs(posLastClosedDate), 'day')
    : null;
  const isOverdue = daysSinceClose !== null && daysSinceClose >= 2;
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [form] = Form.useForm();

  const openTerminal = () => {
    form.resetFields();
    setPinModalOpen(true);
  };

  const handleVerifyPassword = async () => {
    try {
      const values = await form.validateFields();
      if (!user?.email) return;
      setPinLoading(true);
      await authApi.login(user.email, values.password);
      setPosVerified(true);
      setPinModalOpen(false);
      navigate('/pos/session');
    } catch (err: unknown) {
      const isAxiosError = (e: unknown): e is { response?: { status?: number } } =>
        typeof e === 'object' && e !== null && 'response' in e;
      if (isAxiosError(err) && err.response?.status === 401) {
        message.error('Incorrect password');
      }
      // validation errors are handled by Form — no action needed
    } finally {
      setPinLoading(false);
    }
  };

  const { data: summary, isLoading } = useQuery({
    queryKey: ['pos-session-summary', queryFrom, today],
    queryFn: () => salesApi.getSalesSummary(queryFrom, today),
    refetchInterval: 30_000,
  });

  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const shopName = systemSettings?.companyName || 'Nexora ERP';
  const totalSold: number = (summary as any)?.totalRevenue ?? 0;
  const invoiceCount: number = (summary as any)?.totalInvoices ?? 0;
  // Has unclosed sales since last close
  const hasOpenSales = invoiceCount > 0;

  return (
    <>
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShoppingCartOutlined style={{ marginRight: 10 }} />
          Point of Sale
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openTerminal}
        >
          New Session
        </Button>
      </div>

      {/* Search / filter bar placeholder */}
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '8px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          border: '1px solid #f0f0f0',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>1–1 / 1</Text>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Single session card (one per shop / cashier in future) */}
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ borderRadius: 12, border: '1px solid #e8e8e8' }}
              bodyStyle={{ padding: 20 }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>{shopName}</Title>
                  <Tag
                    color={isOverdue && hasOpenSales ? 'red' : hasOpenSales ? 'orange' : 'green'}
                    style={{ marginTop: 6, fontWeight: 600 }}
                  >
                    {isOverdue && hasOpenSales ? '⚠ Overdue – Must Close' : hasOpenSales ? 'To Close' : 'Open'}
                  </Tag>
                </div>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'open', label: 'Open POS', icon: <PlayCircleOutlined />, onClick: openTerminal },
                      { key: 'orders', label: 'View Orders', icon: <ShoppingCartOutlined />, onClick: () => navigate('/pos/orders') },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button type="text" icon={<EllipsisOutlined />} />
                </Dropdown>
              </div>

              {/* Continue Selling button */}
              <Button
                type="primary"
                block
                icon={<PlayCircleOutlined />}
                onClick={openTerminal}
                style={{
                  background: '#4a2560',
                  borderColor: '#4a2560',
                  fontWeight: 600,
                  height: 40,
                  marginBottom: isOverdue && hasOpenSales ? 10 : 16,
                }}
              >
                Continue Selling
              </Button>

              {/* Overdue reminder banner */}
              {isOverdue && hasOpenSales && (
                <Alert
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ marginBottom: 16, borderRadius: 6 }}
                  message={
                    <span>
                      Register not closed for <strong>{daysSinceClose} day{daysSinceClose !== 1 ? 's' : ''}</strong>.
                      Please close the register to reconcile sales.
                    </span>
                  }
                />
              )}

              {/* Session stats */}
              <Space direction="vertical" style={{ width: '100%' }} size={6}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">
                    <CalendarOutlined style={{ marginRight: 6 }} />Date
                  </Text>
                  <Text strong>{dayjs().format('MMM D')}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">
                    <DollarOutlined style={{ marginRight: 6 }} />Opening
                  </Text>
                  <Text strong>{formatCurrency(0)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">
                    <ShoppingCartOutlined style={{ marginRight: 6 }} />Sold
                  </Text>
                  <Text strong style={{ color: '#1677ff' }}>
                    {formatCurrency(totalSold)}{' '}
                    <Text type="secondary" style={{ fontSize: 11 }}>({invoiceCount} order{invoiceCount !== 1 ? 's' : ''})</Text>
                  </Text>
                </div>
                {daysSinceClose !== null && daysSinceClose > 0 && hasOpenSales && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Since {dayjs(queryFrom).format('MMM D')} — {dayjs(today).format('MMM D')}
                    </Text>
                    <Text type={isOverdue ? 'danger' : 'warning'} style={{ fontSize: 11 }}>
                      {daysSinceClose} day{daysSinceClose !== 1 ? 's' : ''} unclosed
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick stats row */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Statistic
              title="Today's Revenue"
              value={totalSold}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#e6f7ff', border: '1px solid #91d5ff' }}>
            <Statistic
              title="Orders Today"
              value={invoiceCount}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#fff7e6', border: '1px solid #ffd591' }}>
            <Statistic
              title="Avg. Order Value"
              value={invoiceCount > 0 ? totalSold / invoiceCount : 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
      </Row>
    </Space>

      {/* Password gate modal */}
      <Modal
        open={pinModalOpen}
        title={
          <Space>
            <LockOutlined />
            Enter Password to Open Terminal
          </Space>
        }
        onCancel={() => setPinModalOpen(false)}
        onOk={handleVerifyPassword}
        okText="Open Terminal"
        confirmLoading={pinLoading}
        width={380}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, color: '#666', fontSize: 13 }}>
          Logged in as <strong>{user?.email}</strong>
        </div>
        <Form form={form} layout="vertical" onFinish={handleVerifyPassword}>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoFocus
              onPressEnter={handleVerifyPassword}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default POSDashboardPage;
