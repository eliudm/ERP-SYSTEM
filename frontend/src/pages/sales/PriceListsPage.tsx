import React, { useState } from 'react';
import {
  Button, Table, Space, Modal, Form, Input, message,
  Typography, Card, Switch, InputNumber,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../../api/sales.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const PriceListsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => salesApi.getPriceLists(),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => salesApi.createPriceList(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); message.success('Price list created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => salesApi.updatePriceList(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); message.success('Updated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: any }) => salesApi.addPriceListItem(id, item),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); message.success('Item added'); setItemOpen(false); itemForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const expandedRowRender = (record: any) => {
    const itemCols: ColumnsType<any> = [
      { title: 'Product', key: 'product', render: (_, r) => r.product?.name ?? r.productId },
      { title: 'Price', dataIndex: 'price', key: 'price' },
      { title: 'Min Qty', dataIndex: 'minQty', key: 'minQty' },
      { title: 'Discount %', dataIndex: 'discountPercent', key: 'discount', render: (v) => v ? `${v}%` : '—' },
    ];
    return (
      <div style={{ padding: '0 24px 16px' }}>
        <Table columns={itemCols} dataSource={record.items ?? []} rowKey="id" size="small" pagination={false} />
        <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }}
          onClick={() => { setSelectedId(record.id); setItemOpen(true); }}>Add Item</Button>
      </div>
    );
  };

  const columns: ColumnsType<any> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'desc', render: (v) => v ?? '—' },
    { title: 'Currency', dataIndex: 'currency', key: 'currency' },
    { title: 'Items', key: 'items', render: (_, r) => (r.items ?? []).length },
    {
      title: 'Active', key: 'active', render: (_, r) => (
        <Switch checked={r.isActive} size="small"
          onChange={(v) => updateMutation.mutate({ id: r.id, data: { isActive: v } })} />
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Price Lists</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Price List</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={priceLists} loading={isLoading} rowKey="id" size="small"
          expandable={{ expandedRowRender }} />
      </Card>

      <Modal title="New Price List" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="currency" label="Currency" initialValue="KES"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Price List Item" open={itemOpen} onCancel={() => setItemOpen(false)}
        onOk={() => itemForm.submit()} confirmLoading={addItemMutation.isPending} destroyOnClose>
        <Form form={itemForm} layout="vertical" style={{ marginTop: 12 }}
          onFinish={(v) => addItemMutation.mutate({ id: selectedId, item: v })}>
          <Form.Item name="productId" label="Product ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="price" label="Price" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="minQty" label="Minimum Quantity" initialValue={1}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="discountPercent" label="Discount %"><InputNumber style={{ width: '100%' }} min={0} max={100} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default PriceListsPage;
