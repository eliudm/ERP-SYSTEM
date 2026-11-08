import React, { useState } from 'react';
import {
  Avatar, Button, Card, Divider, Form, Input,
  Space, Tag, Typography, message,
} from 'antd';
import { UserOutlined, LockOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';

const { Title, Text } = Typography;

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'purple',
  SALES_USER: 'blue',
  PROCUREMENT_OFFICER: 'orange',
  ACCOUNTANT: 'green',
  HR_MANAGER: 'cyan',
};

export const ProfilePage: React.FC = () => {
  const currentUser = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const queryClient = useQueryClient();
  const [nameForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [editingName, setEditingName] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: (dto: { firstName?: string; lastName?: string }) =>
      authApi.updateProfile(dto),
    onSuccess: (updated) => {
      setProfile(updated as any);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      message.success('Profile updated');
      setEditingName(false);
    },
    onError: () => message.error('Failed to update profile'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (dto: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(dto.currentPassword, dto.newPassword),
    onSuccess: () => {
      message.success('Password changed successfully');
      pwForm.resetFields();
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.message || 'Failed to change password'),
  });

  if (!currentUser) return null;

  const initials = `${currentUser.firstName?.[0] ?? ''}${currentUser.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <Title level={3} style={{ marginBottom: 24 }}>My Profile</Title>

      {/* Identity card */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 20 }}>
        <Space align="start" size={20} style={{ width: '100%' }}>
          <Avatar size={72} style={{ background: '#4a2560', fontSize: 28, flexShrink: 0 }}>
            {initials}
          </Avatar>
          <div style={{ flex: 1 }}>
            {editingName ? (
              <Form
                form={nameForm}
                layout="inline"
                initialValues={{ firstName: currentUser.firstName, lastName: currentUser.lastName }}
                onFinish={(vals) => updateProfileMutation.mutate(vals)}
                style={{ flexWrap: 'wrap', gap: 8 }}
              >
                <Form.Item name="firstName" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Input placeholder="First name" />
                </Form.Item>
                <Form.Item name="lastName" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Input placeholder="Last name" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 8 }}>
                  <Space>
                    <Button type="primary" htmlType="submit" size="small" loading={updateProfileMutation.isPending}>Save</Button>
                    <Button size="small" onClick={() => setEditingName(false)}>Cancel</Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {currentUser.firstName} {currentUser.lastName}
                </Title>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => { setEditingName(true); nameForm.setFieldsValue({ firstName: currentUser.firstName, lastName: currentUser.lastName }); }}
                />
              </div>
            )}
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{currentUser.email}</Text>
            <Space>
              <Tag color={ROLE_COLOR[currentUser.role] ?? 'default'}>{currentUser.role?.replace('_', ' ')}</Tag>
              {currentUser.posOnly && <Tag color="gold">POS Only</Tag>}
            </Space>
          </div>
        </Space>
      </Card>

      {/* Change password */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        title={<Space><LockOutlined /><span>Change Password</span></Space>}
      >
        <Form
          form={pwForm}
          layout="vertical"
          onFinish={(vals) => changePasswordMutation.mutate(vals)}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[{ required: true, min: 6, message: 'At least 6 characters' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
          </Form.Item>
          <Divider style={{ margin: '8px 0 16px' }} />
          <Button
            type="primary"
            htmlType="submit"
            loading={changePasswordMutation.isPending}
            icon={<LockOutlined />}
          >
            Change Password
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default ProfilePage;
