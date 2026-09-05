import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const StockTransfersPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => inventoryApi.getStockTransfers(),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });
  const warehouses = (warehousesData as any)?.data ?? warehousesData ?? [];

  const createMutation = useMutation({
    mutationFn: (v: any) => inventoryApi.createStockTransfer(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-transfers'] }); message.success('Transfer created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.completeTransfer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-transfers'] }); message.success('Transfer completed'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Transfer No.', dataIndex: 'transferNumber', key: 'no' },
    { title: 'From', key: 'from', render: (_, r) => r.fromWarehouse?.name },
    { title: 'To', key: 'to', render: (_, r) => r.toWarehouse?.name },
    { title: 'Lines', key: 'lines', render: (_, r) => (r.lines ?? []).length },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.createdAt).toLocaleDateString() },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'PENDING' ? 'blue' : 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        r.status === 'PENDING' ? (
          <Popconfirm title="Mark transfer as completed?" onConfirm={() => completeMutation.mutate(r.id)} okText="Complete">
            <Button size="small" icon={<CheckOutlined />}>Complete</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Stock Transfers</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Transfer</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={transfers} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Stock Transfer" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="fromWarehouseId" label="From Warehouse" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item name="toWarehouseId" label="To Warehouse" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default StockTransfersPage;
