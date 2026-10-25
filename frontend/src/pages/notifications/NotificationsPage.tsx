import React, { useState } from 'react';
import {
  Table, Tag, Space, Button, Typography, Card, message, Empty,
} from 'antd';
import { CheckOutlined, BellOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications.api';
import type { Notification } from '../../api/notifications.api';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const TYPE_LABEL: Record<Notification['type'], string> = {
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  SYSTEM: 'System',
};

const TYPE_COLOR: Record<Notification['type'], string> = {
  LOW_STOCK: 'orange',
  OUT_OF_STOCK: 'red',
  SYSTEM: 'blue',
};

const PAGE_SIZE = 20;

export const NotificationsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notifications', 'all', page],
    queryFn: () => notificationsApi.getAll(page, PAGE_SIZE),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      invalidateAll();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to mark as read'),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      message.success('All notifications marked as read');
      invalidateAll();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to mark all as read'),
  });

  const notifications = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasUnread = notifications.some((n) => !n.isRead);

  const columns: ColumnsType<Notification> = [
    {
      title: '',
      key: 'status',
      width: 36,
      render: (_, r) => (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: r.isRead ? 'transparent' : '#1677ff',
          }}
        />
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (v: Notification['type']) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (v, r) => <Text strong={!r.isRead}>{v}</Text>,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (v, r) => <Text type={r.isRead ? 'secondary' : undefined}>{v}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => dayjs(v).format('MMM D, YYYY HH:mm'),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Status',
      key: 'read',
      width: 100,
      render: (_, r) => (r.isRead ? <Tag>Read</Tag> : <Tag color="blue">Unread</Tag>),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, r) =>
        !r.isRead ? (
          <Button
            size="small"
            icon={<CheckOutlined />}
            loading={markOneMutation.isPending && markOneMutation.variables === r.id}
            onClick={() => markOneMutation.mutate(r.id)}
          >
            Mark read
          </Button>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          Notifications
        </Title>
        <Button
          icon={<CheckOutlined />}
          disabled={!hasUnread}
          loading={markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
        >
          Mark all read
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={notifications}
          loading={isLoading || isFetching}
          rowKey="id"
          size="small"
          locale={{
            emptyText: <Empty description="No notifications" />,
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} notifications`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </Space>
  );
};

export default NotificationsPage;
