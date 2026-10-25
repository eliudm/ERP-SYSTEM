import React, { useState } from 'react';
import {
  Table, Tag, Space, Select, message, Typography, Card, Button, Modal, Input,
  Tooltip,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, SyncOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { workflowApi } from '../../api/workflow.api';
import { useAuthStore } from '../../store/auth.store';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// ─── Local types ──────────────────────────────────────────────────────────────
type ApprovalEntityType = 'SALES_INVOICE' | 'PURCHASE_ORDER' | 'PAYROLL';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED';

interface ApprovalRequest {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  status: ApprovalStatus;
  assignedRole: string | null;
  amountSnapshot: number | string | null;
  requestedById: string | null;
  approvedById: string | null;
  rejectedById: string | null;
  comments: string | null;
  rejectionReason: string | null;
  dueAt: string | null;
  escalationCount: number;
  lastEscalatedAt: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  consumedAt: string | null;
}

const ENTITY_TYPES: ApprovalEntityType[] = ['SALES_INVOICE', 'PURCHASE_ORDER', 'PAYROLL'];
const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CONSUMED'];

const STATUS_COLOR: Record<ApprovalStatus, string> = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  CONSUMED: 'default',
};

const ENTITY_LABEL: Record<ApprovalEntityType, string> = {
  SALES_INVOICE: 'Sales Invoice',
  PURCHASE_ORDER: 'Purchase Order',
  PAYROLL: 'Payroll',
};

const formatMoney = (v: number | string | null | undefined) => {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// ─── Decision modal (approve / reject) ────────────────────────────────────────
const DecisionModal: React.FC<{
  request: ApprovalRequest | null;
  action: 'approve' | 'reject' | null;
  onClose: () => void;
}> = ({ request, action, onClose }) => {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const approveMutation = useMutation({
    mutationFn: (id: string) => workflowApi.approveRequest(id, text || undefined),
    onSuccess: () => {
      message.success('Request approved');
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
      close();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => workflowApi.rejectRequest(id, text || undefined),
    onSuccess: () => {
      message.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
      close();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const close = () => {
    setText('');
    onClose();
  };

  const isApprove = action === 'approve';
  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Modal
      title={isApprove ? 'Approve Request' : 'Reject Request'}
      open={!!request && !!action}
      onCancel={close}
      okText={isApprove ? 'Approve' : 'Reject'}
      okButtonProps={{ danger: !isApprove, loading: pending }}
      onOk={() => {
        if (!request) return;
        if (isApprove) approveMutation.mutate(request.id);
        else rejectMutation.mutate(request.id);
      }}
      destroyOnClose
    >
      {request && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            {ENTITY_LABEL[request.entityType]} · {request.entityId}
          </Text>
          <Input.TextArea
            rows={3}
            placeholder={isApprove ? 'Optional comment…' : 'Optional reason…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Space>
      )}
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const ApprovalsPage: React.FC = () => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [entityTypeFilter, setEntityTypeFilter] = useState<ApprovalEntityType | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | undefined>(undefined);
  const [decision, setDecision] = useState<{ request: ApprovalRequest; action: 'approve' | 'reject' } | null>(null);

  const { data: requests = [], isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['approval-requests', entityTypeFilter, statusFilter],
    queryFn: () => workflowApi.getRequests(entityTypeFilter, undefined, statusFilter),
  });

  const overdueMutation = useMutation({
    mutationFn: () => workflowApi.runOverdueCheck(),
    onSuccess: (res) => {
      message.success(`Overdue check complete: ${res?.escalated ?? 0} escalated of ${res?.scanned ?? 0} scanned`);
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<ApprovalRequest> = [
    {
      title: 'Entity', key: 'entity',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{ENTITY_LABEL[r.entityType]}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.entityId}</Text>
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v: ApprovalStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Assigned Role', dataIndex: 'assignedRole', key: 'assignedRole',
      render: (v) => v ?? '—',
    },
    {
      title: 'Amount', dataIndex: 'amountSnapshot', key: 'amountSnapshot',
      render: (v) => formatMoney(v),
    },
    {
      title: 'Requested', dataIndex: 'requestedAt', key: 'requestedAt',
      render: (v) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Due', dataIndex: 'dueAt', key: 'dueAt',
      render: (v, r) => {
        if (!v) return '—';
        const overdue = r.status === 'PENDING' && dayjs(v).isBefore(dayjs());
        return (
          <Space size={4}>
            <Text type={overdue ? 'danger' : undefined}>{dayjs(v).format('DD MMM YYYY HH:mm')}</Text>
            {overdue && <ClockCircleOutlined style={{ color: '#ff4d4f' }} />}
          </Space>
        );
      },
    },
    {
      title: 'Escalations', dataIndex: 'escalationCount', key: 'escalationCount',
      render: (v) => v > 0 ? <Tag color="orange">{v}</Tag> : '—',
    },
    {
      title: 'Comments / Reason', key: 'notes',
      render: (_, r) => (
        <Tooltip title={r.comments ?? r.rejectionReason ?? ''}>
          <Text style={{ maxWidth: 180, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.rejectionReason ?? r.comments ?? '—'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '', key: 'actions',
      render: (_, r) => (
        r.status === 'PENDING' ? (
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => setDecision({ request: r, action: 'approve' })}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => setDecision({ request: r, action: 'reject' })}
            >
              Reject
            </Button>
          </Space>
        ) : null
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Approvals</Title>
        {isAdmin && (
          <Button
            icon={<SyncOutlined />}
            loading={overdueMutation.isPending}
            onClick={() => overdueMutation.mutate()}
          >
            Run Overdue Check
          </Button>
        )}
      </div>

      <Space wrap>
        <Select
          allowClear
          placeholder="All entity types"
          style={{ width: 180 }}
          value={entityTypeFilter}
          onChange={(v) => setEntityTypeFilter(v)}
          options={ENTITY_TYPES.map((t) => ({ value: t, label: ENTITY_LABEL[t] }))}
        />
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={requests}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} requests` }}
        />
      </Card>

      <DecisionModal
        request={decision?.request ?? null}
        action={decision?.action ?? null}
        onClose={() => setDecision(null)}
      />
    </Space>
  );
};

export default ApprovalsPage;
