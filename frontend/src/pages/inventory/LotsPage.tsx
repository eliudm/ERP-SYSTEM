import React, { useState } from 'react';
import {
  Button, Table, Space, Modal, Form, Input, Select, message,
  Typography, Card,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const LotsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ['lots'],
    queryFn: () => inventoryApi.getLots(),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => inventoryApi.getProducts(),
  });
  const products = (productsData as any)?.data ?? productsData ?? [];

  const createMutation = useMutation({
    mutationFn: (v: any) => inventoryApi.createLot(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lots'] }); message.success('Lot created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Lot Number', dataIndex: 'lotNumber', key: 'no' },
    { title: 'Product', key: 'product', render: (_, r) => r.product?.name },
    { title: 'Quantity', dataIndex: 'quantity', key: 'qty' },
    { title: 'Manufacture Date', key: 'mfg', render: (_, r) => r.manufactureDate ? new Date(r.manufactureDate).toLocaleDateString() : '—' },
    { title: 'Expiry Date', key: 'exp', render: (_, r) => r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—' },
    { title: 'Created', key: 'created', render: (_, r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Lots</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Lot</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={lots} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Lot" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(products as any[]).map((p: any) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="lotNumber" label="Lot Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="manufactureDate" label="Manufacture Date"><Input type="date" /></Form.Item>
          <Form.Item name="expiryDate" label="Expiry Date"><Input type="date" /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default LotsPage;
