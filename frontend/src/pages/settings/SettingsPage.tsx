import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Tabs,
  Typography,
  message,
} from 'antd';
import { SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { settingsApi } from '../../api/settings.api';
import type { SystemSettings } from '../../types';

const { Title, Text } = Typography;

const navigationItems = [
  {
    key: 'general',
    label: 'General',
    description: 'Preferences and workflow defaults',
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Accounts and access control',
  },
  {
    key: 'companies',
    label: 'Companies',
    description: 'Business identity and receipt data',
  },
  {
    key: 'localization',
    label: 'Localization',
    description: 'Language, timezone, and currency',
  },
  {
    key: 'tax',
    label: 'Tax Rates',
    description: 'Tax rates and groups configuration',
  },
];

const _editableKeys = [
  'companyName',
  'companyPin',
  'companyAddress',
  'receiptSlogan',
  'defaultCurrency',
  'timezone',
  'defaultLanguage',
  'emailNotifications',
  'autoApproveDrafts',
  'showLowStockAlerts',
  'lowStockThreshold',
  'posReceiptBranding',
  'companyLogo',
] as const;

type EditableSettingsKey = (typeof _editableKeys)[number];

const toEditablePayload = (settings: SystemSettings | null): Pick<SystemSettings, EditableSettingsKey> | null => {
  if (!settings) {
    return null;
  }

  return {
    companyName: settings.companyName,
    companyLogo: settings.companyLogo,
    companyPin: settings.companyPin,
    companyAddress: settings.companyAddress,
    receiptSlogan: settings.receiptSlogan,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    defaultLanguage: settings.defaultLanguage,
    emailNotifications: settings.emailNotifications,
    autoApproveDrafts: settings.autoApproveDrafts,
    showLowStockAlerts: settings.showLowStockAlerts,
    lowStockThreshold: settings.lowStockThreshold,
    posReceiptBranding: settings.posReceiptBranding,
  };
};

export interface SettingsOutletContext {
  draft: SystemSettings | null;
  search: string;
  updateDraft: (patch: Partial<SystemSettings>) => void;
}

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<SystemSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  useEffect(() => {
    if (settings) {
      setDraft(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<SystemSettings>) => settingsApi.updateSystemSettings(payload),
    onSuccess: (updatedSettings) => {
      setDraft(updatedSettings);
      queryClient.setQueryData(['system-settings'], updatedSettings);
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      message.success('Settings saved');
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const data = error?.response?.data;
      // class-validator returns an array in data.message for validation errors
      const detail = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || error?.message || 'Unknown error';
      const prefix = status === 413 ? 'Payload too large – try a smaller logo.' : `Save failed (${status ?? 'network error'})`;
      message.error(`${prefix}: ${detail}`, 6);
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredNavigation = navigationItems.filter((item) => {
    if (!normalizedSearch) {
      return true;
    }

    const haystack = `${item.label} ${item.description}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const activeKey = useMemo(() => {
    const match = location.pathname.split('/')[2];
    return match || 'general';
  }, [location.pathname]);

  const isDirty = useMemo(() => {
    const current = toEditablePayload(settings || null);
    const pending = toEditablePayload(draft || null);
    return JSON.stringify(current) !== JSON.stringify(pending);
  }, [draft, settings]);

  const updateDraft = (patch: Partial<SystemSettings>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveChanges = () => {
    if (!draft) {
      return;
    }

    updateMutation.mutate(toEditablePayload(draft) || {});
  };

  const discardChanges = () => {
    if (!settings) {
      return;
    }

    setDraft(settings);
    message.info('Changes discarded');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card
        bordered={false}
        style={{
          borderRadius: 28,
          background: 'rgba(255,255,255,0.82)',
          boxShadow: '0 24px 60px rgba(96, 84, 138, 0.08)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '20px 24px 0' }}>
          <Space size="large" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size="middle">
              <Avatar
                size={34}
                style={{ background: 'linear-gradient(135deg, #f08c2f 0%, #f953c6 100%)' }}
                icon={<SettingOutlined />}
              />
              <Title level={3} style={{ margin: 0 }}>
                Settings
              </Title>
            </Space>
            <Tabs
              activeKey={activeKey}
              onChange={(key) => navigate(`/settings/${key}`)}
              items={navigationItems.map((item) => ({ key: item.key, label: item.label }))}
              style={{ minWidth: 360 }}
            />
          </Space>

          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              paddingBottom: 20,
            }}
          >
            <Space>
              <Button
                type="primary"
                onClick={saveChanges}
                loading={updateMutation.isPending}
                disabled={!isDirty || !draft}
                style={{
                  borderRadius: 10,
                  background: '#7d4c6f',
                  borderColor: '#7d4c6f',
                  minWidth: 92,
                }}
              >
                Save
              </Button>
              <Button
                onClick={discardChanges}
                disabled={!isDirty || !draft}
                style={{ borderRadius: 10, minWidth: 92 }}
              >
                Discard
              </Button>
            </Space>

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search settings..."
              style={{ maxWidth: 520, borderRadius: 12 }}
              allowClear
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #ece8f5', display: 'grid', gridTemplateColumns: '280px 1fr' }}>
          <div
            style={{
              padding: 20,
              borderRight: '1px solid #ece8f5',
              minHeight: 560,
              background: 'rgba(248, 248, 252, 0.72)',
            }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {filteredNavigation.map((item) => {
                const active = activeKey === item.key;
                return (
                  <NavLink
                    key={item.key}
                    to={`/settings/${item.key}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: active ? '#fff' : 'transparent',
                        boxShadow: active ? '0 10px 25px rgba(96, 84, 138, 0.08)' : 'none',
                      }}
                    >
                      <Text style={{ display: 'block', color: '#2f2749', fontWeight: active ? 700 : 600 }}>
                        {item.label}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.description}
                      </Text>
                    </div>
                  </NavLink>
                );
              })}

              {filteredNavigation.length === 0 && (
                <Card bordered={false} style={{ borderRadius: 16, background: '#fff8f1' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No settings pages match your search" />
                </Card>
              )}
            </Space>
          </div>

          <div style={{ padding: 24 }}>
            {isLoading && !draft ? (
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <Text type="secondary">Loading settings...</Text>
              </Card>
            ) : (
              <Outlet context={{ draft, search, updateDraft }} />
            )}
          </div>
        </div>
      </Card>
    </Space>
  );
};
