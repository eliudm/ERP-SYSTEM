import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = { AVAILABLE: 'green', SOLD: 'blue', DAMAGED: 'red', RESERVED: 'orange' };

export const SerialNumbersPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: serials = [], isLoading } = useQuery({
    queryKey: ['serials'],
    queryFn: () => inventoryApi.getSerials(),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => inventoryApi.getProducts(),
  });
  const products = (productsData as any)?.data ?? productsData ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });
  const warehouses = (warehousesData as any)?.data ?? warehousesData ?? [];

  const createMutation = useMutation({
    mutationFn: (v: any) => inventoryApi.createSerial(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serials'] }); message.success('Serial number created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Serial Number', dataIndex: 'serialNumber', key: 'serial' },
    { title: 'Product', key: 'product', render: (_, r) => r.product?.name },
    { title: 'Warehouse', key: 'warehouse', render: (_, r) => r.warehouse?.name ?? '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag> },
    { title: 'Created', key: 'created', render: (_, r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Serial Numbers</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Serial</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={serials} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Serial Number" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(products as any[]).map((p: any) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="serialNumber" label="Serial Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="warehouseId" label="Warehouse">
            <Select allowClear showSearch optionFilterProp="label"
              options={(warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default SerialNumbersPage;
