import React from 'react';
import {
  Card, Switch, Typography, Space, Row, Col, Tag, message as antMessage,
} from 'antd';
import {
  AppstoreOutlined, ShoppingCartOutlined, AccountBookOutlined,
  InboxOutlined, ShoppingOutlined, TeamOutlined,
  SafetyCertificateOutlined, ContactsOutlined, FundProjectionScreenOutlined,
  ApartmentOutlined, LineChartOutlined, BulbOutlined,
  CheckSquareOutlined, NotificationOutlined, MessageOutlined,
  CustomerServiceOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type ModuleKey } from '../../api/settings.api';
import { useAuthStore } from '../../store/auth.store';

const { Title, Text } = Typography;

interface ModuleDef {
  key: ModuleKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  alwaysOn?: boolean;
}

const MODULES: ModuleDef[] = [
  { key: 'pos', label: 'Point of Sale', description: 'POS terminal, sessions, and receipts', icon: <AppstoreOutlined /> },
  { key: 'sales', label: 'Sales', description: 'Invoices, quotations, customers, credit notes', icon: <ShoppingCartOutlined /> },
  { key: 'accounting', label: 'Accounting', description: 'Journals, reports, bank accounts, budgets', icon: <AccountBookOutlined /> },
  { key: 'inventory', label: 'Inventory', description: 'Products, warehouses, stock movements', icon: <InboxOutlined /> },
  { key: 'procurement', label: 'Procurement', description: 'Purchase orders, vendor bills, suppliers', icon: <ShoppingOutlined /> },
  { key: 'hr', label: 'Human Resources', description: 'Employees, payroll, leave, attendance', icon: <TeamOutlined /> },
  { key: 'etims', label: 'eTIMS (KRA)', description: 'Kenya Revenue Authority tax integration', icon: <SafetyCertificateOutlined /> },
  { key: 'contacts', label: 'Contacts', description: 'Unified contact and address book', icon: <ContactsOutlined /> },
  { key: 'crm', label: 'CRM', description: 'Leads, opportunities, pipeline', icon: <FundProjectionScreenOutlined /> },
  { key: 'mrp', label: 'Manufacturing', description: 'Bills of materials, work orders', icon: <ApartmentOutlined /> },
  { key: 'analytics', label: 'Analytics', description: 'Business intelligence and dashboards', icon: <LineChartOutlined /> },
  { key: 'aiInsights', label: 'AI Insights', description: 'AI-powered business recommendations', icon: <BulbOutlined /> },
  { key: 'approvals', label: 'Approvals', description: 'Multi-step approval workflows', icon: <CheckSquareOutlined /> },
  { key: 'notifications', label: 'Notifications', description: 'In-app alerts and notification centre', icon: <NotificationOutlined /> },
  { key: 'messaging', label: 'Messaging', description: 'SMS campaigns and WhatsApp', icon: <MessageOutlined /> },
  { key: 'support', label: 'Support', description: 'Help desk and ticket management', icon: <CustomerServiceOutlined /> },
  { key: 'help', label: 'Help Center', description: 'Knowledge base and FAQs', icon: <QuestionCircleOutlined /> },
];

export const ModulesSettingsPage: React.FC = () => {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'ADMIN';

  const { data: config, isLoading } = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: settingsApi.getModuleConfig,
  });

  const mutation = useMutation({
    mutationFn: settingsApi.updateModuleConfig,
    onSuccess: (updated) => {
      qc.setQueryData(['settings', 'modules'], updated);
      antMessage.success('Module settings saved');
    },
    onError: () => antMessage.error('Failed to save module settings'),
  });

  const toggle = (key: ModuleKey, enabled: boolean) => {
    if (!isAdmin) return;
    mutation.mutate({ [key]: enabled });
  };

  const enabledCount = config ? Object.values(config).filter(Boolean).length : 0;

  return (
    <div style={{ padding: '0 4px' }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Modules</Title>
        <Text type="secondary">
          Enable or disable application modules for all users in your organisation.
          Disabled modules are hidden from navigation.
        </Text>
        {config && (
          <Tag color="blue">{enabledCount} of {MODULES.length} modules active</Tag>
        )}
      </Space>

      <Row gutter={[16, 16]}>
        {MODULES.map((mod) => {
          const enabled = config ? config[mod.key] !== false : true;
          return (
            <Col xs={24} sm={12} lg={8} key={mod.key}>
              <Card
                size="small"
                styles={{ body: { padding: '14px 16px' } }}
                style={{
                  borderColor: enabled ? '#1677ff' : undefined,
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s, opacity 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    fontSize: 22,
                    color: enabled ? '#1677ff' : '#8c8c8c',
                    marginTop: 2,
                    transition: 'color 0.2s',
                  }}>
                    {mod.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 14 }}>{mod.label}</Text>
                      <Switch
                        checked={enabled}
                        onChange={(v) => toggle(mod.key, v)}
                        disabled={!isAdmin || mutation.isPending}
                        size="small"
                      />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, lineHeight: '1.4' }}>
                      {mod.description}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {!isAdmin && (
        <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
          Only administrators can change module settings.
        </Text>
      )}
    </div>
  );
};

export default ModulesSettingsPage;
