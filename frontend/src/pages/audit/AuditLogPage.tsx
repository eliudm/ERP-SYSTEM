import React, { useState } from 'react';
import {
  Table, Card, Typography, Space, Input, Tag, Button, Modal, Descriptions,
} from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/audit.api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

export const AuditLogPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [tableName, setTableName] = useState('');
  const [action, setAction] = useState('');
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', page, limit, tableName, action],
    queryFn: () =>
      auditApi.getLogs(page, limit, tableName || undefined, action || undefined),
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
      width: 200,
    },
    {
      title: 'Actor',
      dataIndex: 'userId',
      key: 'userId',
      render: (v: string | null) => v ?? <Text type="secondary">System</Text>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color={ACTION_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Table',
      dataIndex: 'tableName',
      key: 'tableName',
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Record ID',
      dataIndex: 'recordId',
      key: 'recordId',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>
          View Diff
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Audit Log</Title>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
          Refresh
        </Button>
      </div>

      <Space wrap>
        <Input
          placeholder="Filter by table name…"
          allowClear
          style={{ width: 220 }}
          value={tableName}
          onChange={(e) => { setPage(1); setTableName(e.target.value); }}
        />
        <Input
          placeholder="Filter by action (CREATE, UPDATE, DELETE)…"
          allowClear
          style={{ width: 260 }}
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{
            current: meta?.page ?? page,
            pageSize: meta?.limit ?? limit,
            total: meta?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (t) => `${t} entries`,
            onChange: (p, ps) => { setPage(p); setLimit(ps); },
          }}
        />
      </Card>

      <Modal
        title="Audit Entry Detail"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={700}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Timestamp">{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Actor">{detail.userId ?? 'System'}</Descriptions.Item>
              <Descriptions.Item label="Action">
                <Tag color={ACTION_COLOR[detail.action] ?? 'default'}>{detail.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Table">{detail.tableName}</Descriptions.Item>
              <Descriptions.Item label="Record ID">{detail.recordId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="IP Address">{detail.ipAddress ?? '—'}</Descriptions.Item>
            </Descriptions>
            <div>
              <Text strong>Old Values</Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 220, overflow: 'auto' }}>
                {detail.oldValues ? JSON.stringify(detail.oldValues, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <Text strong>New Values</Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 220, overflow: 'auto' }}>
                {detail.newValues ? JSON.stringify(detail.newValues, null, 2) : '—'}
              </pre>
            </div>
          </Space>
        )}
      </Modal>
    </Space>
  );
};

export default AuditLogPage;
