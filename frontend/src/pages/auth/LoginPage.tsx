import React, { useState } from 'react';
import {
  Form, Input, Button, Card,
  Typography, Alert, Space, Select,
} from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { LANGUAGE_STORAGE_KEY } from '../../i18n/languageMap';

const { Title, Text } = Typography;

const LANGUAGE_SWITCHER_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Kiswahili' },
  { value: 'fr', label: 'Français' },
];

export const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // storage unavailable (private mode, etc.) — language still applies for this session
    }
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(values.email, values.password);
      setAuth(res.access_token, res.user);
      // POS-only users go straight to the POS terminal
      navigate(res.user.posOnly ? '/pos/session' : '/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || t('loginFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
        position: 'relative',
      }}
    >
      <Select
        value={i18n.language}
        onChange={changeLanguage}
        options={LANGUAGE_SWITCHER_OPTIONS}
        style={{ position: 'absolute', top: 24, right: 24, width: 140 }}
        aria-label={t('language')}
      />

      <Card style={{ width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Logo */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                background: '#1677ff',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>
                N
              </Text>
            </div>
            <Title level={3} style={{ margin: 0 }}>
              {t('title')}
            </Title>
            <Text type="secondary">{t('subtitle')}</Text>
          </div>

          {error && (
            <Alert message={error} type="error" showIcon closable />
          )}

          <Form
            layout="vertical"
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="email"
              label={t('emailLabel')}
              rules={[
                { required: true, message: t('emailRequired') },
                { type: 'email', message: t('emailInvalid') },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('emailPlaceholder')}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('passwordLabel')}
              rules={[{ required: true, message: t('passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('passwordPlaceholder')}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                {t('signIn')}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};
