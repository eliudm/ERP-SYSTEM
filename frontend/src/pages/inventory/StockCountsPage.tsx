import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const StockCountsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: counts = [], isLoading } = useQuery({
    queryKey: ['stock-counts'],
    queryFn: () => inventoryApi.getStockCounts(),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });
  const warehouses = (warehousesData as any)?.data ?? warehousesData ?? [];

  const createMutation = useMutation({
    mutationFn: (v: any) => inventoryApi.createStockCount(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-counts'] }); message.success('Stock count created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const finalizeMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.finalizeCount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-counts'] }); message.success('Count finalized'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Count No.', dataIndex: 'countNumber', key: 'no' },
    { title: 'Warehouse', key: 'wh', render: (_, r) => r.warehouse?.name },
    { title: 'Lines', key: 'lines', render: (_, r) => (r.lines ?? []).length },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.createdAt).toLocaleDateString() },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'FINALIZED' ? 'green' : v === 'IN_PROGRESS' ? 'blue' : 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        r.status === 'IN_PROGRESS' ? (
          <Popconfirm title="Finalize this stock count? This will adjust inventory." onConfirm={() => finalizeMutation.mutate(r.id)} okText="Finalize">
            <Button size="small" icon={<CheckCircleOutlined />}>Finalize</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Stock Counts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Count</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={counts} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Stock Count" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default StockCountsPage;
