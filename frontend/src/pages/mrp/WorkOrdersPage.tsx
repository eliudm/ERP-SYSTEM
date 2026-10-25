import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, InputNumber, Select, message,
  Typography, Card, Modal, DatePicker, Popconfirm,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, PlayCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mrpApi } from '../../api/mrp.api';
import type { WorkOrder, WorkOrderStatus } from '../../api/mrp.api';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  DRAFT: 'default',
  CONFIRMED: 'blue',
  IN_PROGRESS: 'orange',
  DONE: 'green',
  CANCELLED: 'red',
};

const STATUS_OPTIONS: WorkOrderStatus[] = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

// ─── Create Modal ───────────────────────────────────────────────────────────
const WorkOrderFormModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  // Only ACTIVE BOMs can be used to create work orders (enforced server-side too)
  const { data: boms = [] } = useQuery({
    queryKey: ['boms', 'ACTIVE'],
    queryFn: () => mrpApi.boms.getAll('ACTIVE'),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: (v: any) =>
      mrpApi.workOrders.create({
        bomId: v.bomId,
        quantity: v.quantity,
        scheduledStart: v.scheduledStart ? v.scheduledStart.toISOString() : undefined,
        scheduledEnd: v.scheduledEnd ? v.scheduledEnd.toISOString() : undefined,
        notes: v.notes,
      }),
    onSuccess: () => {
      message.success('Work order created');
      qc.invalidateQueries({ queryKey: ['workOrders'] });
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to create work order'),
  });

  const handleSubmit = () =>
    form.validateFields().then((values) => createMutation.mutate(values));

  const bomOptions = (boms as any[]).map((b) => ({
    value: b.id,
    label: `${b.name} (produces ${b.product?.code ?? ''} — ${b.product?.name ?? ''})`,
  }));

  return (
    <Modal
      open={open}
      title="New Work Order"
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Create"
      confirmLoading={createMutation.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="bomId"
          label="Bill of Materials"
          rules={[{ required: true, message: 'BOM is required' }]}
          extra={bomOptions.length === 0 ? 'No ACTIVE BOMs available — activate a BOM first.' : undefined}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select an active BOM"
            options={bomOptions}
          />
        </Form.Item>
        <Form.Item
          name="quantity"
          label="Quantity to Produce"
          rules={[{ required: true, message: 'Quantity is required' }]}
        >
          <InputNumber min={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="scheduledStart" label="Scheduled Start" style={{ width: '50%' }}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="scheduledEnd" label="Scheduled End" style={{ width: '50%' }}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Internal notes…" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── List Page ──────────────────────────────────────────────────────────────
export const WorkOrdersPage: React.FC = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['workOrders', statusFilter],
    queryFn: () => mrpApi.workOrders.getAll(statusFilter),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['workOrders'] });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => mrpApi.workOrders.confirm(id),
    onSuccess: () => { message.success('Work order confirmed'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to confirm'),
  });
  const startMutation = useMutation({
    mutationFn: (id: string) => mrpApi.workOrders.start(id),
    onSuccess: () => { message.success('Production started'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to start production'),
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => mrpApi.workOrders.complete(id),
    onSuccess: () => { message.success('Work order completed'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to complete'),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => mrpApi.workOrders.cancel(id),
    onSuccess: () => { message.success('Work order cancelled'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to cancel'),
  });

  const anyActionPending =
    confirmMutation.isPending || startMutation.isPending || completeMutation.isPending || cancelMutation.isPending;

  const columns: ColumnsType<WorkOrder> = [
    {
      title: 'Reference', dataIndex: 'reference', key: 'reference',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'BOM / Product', key: 'bom',
      render: (_, r) => r.bom ? `${r.bom.name} (${r.bom.product?.code ?? ''} — ${r.bom.product?.name ?? ''})` : '—',
    },
    {
      title: 'Quantity', dataIndex: 'quantity', key: 'quantity',
      render: (v) => Number(v),
    },
    {
      title: 'Scheduled', key: 'scheduled',
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.scheduledStart ? dayjs(r.scheduledStart).format('MMM D HH:mm') : '—'}
          {' → '}
          {r.scheduledEnd ? dayjs(r.scheduledEnd).format('MMM D HH:mm') : '—'}
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v: WorkOrderStatus) => <Tag color={STATUS_COLOR[v]}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: '', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'DRAFT' && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              loading={confirmMutation.isPending && confirmMutation.variables === r.id}
              disabled={anyActionPending}
              onClick={() => confirmMutation.mutate(r.id)}
            >
              Confirm
            </Button>
          )}
          {r.status === 'CONFIRMED' && (
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={startMutation.isPending && startMutation.variables === r.id}
              disabled={anyActionPending}
              onClick={() => startMutation.mutate(r.id)}
            >
              Start
            </Button>
          )}
          {r.status === 'IN_PROGRESS' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={completeMutation.isPending && completeMutation.variables === r.id}
              disabled={anyActionPending}
              onClick={() => completeMutation.mutate(r.id)}
            >
              Complete
            </Button>
          )}
          {(r.status === 'DRAFT' || r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS') && (
            <Popconfirm
              title="Cancel this work order?"
              description={r.status === 'IN_PROGRESS' ? 'Consumed materials will be returned to stock.' : undefined}
              okText="Cancel Order"
              okButtonProps={{ danger: true }}
              onConfirm={() => cancelMutation.mutate(r.id)}
            >
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={cancelMutation.isPending && cancelMutation.variables === r.id}
                disabled={anyActionPending}
              >
                Cancel
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Work Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New Work Order
        </Button>
      </div>

      <Space wrap>
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={workOrders}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} work orders` }}
        />
      </Card>

      <WorkOrderFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </Space>
  );
};

export default WorkOrdersPage;
