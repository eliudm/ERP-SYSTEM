import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space, Select,
  Modal, Form, DatePicker, Input, InputNumber,
  message, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, CheckOutlined, InboxOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { procurementApi } from '../../api/procurement.api';
import { inventoryApi } from '../../api/inventory.api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import dayjs from 'dayjs';

const { Title } = Typography;

export const PurchaseOrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [createModal, setCreateModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState<any>(null);
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitCost: 0, taxRate: 0.16 }]);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, status],
    queryFn: () => procurementApi.getPurchaseOrders(page, 20, status),
  });

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementApi.getSuppliers() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => inventoryApi.getProducts() });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: inventoryApi.getWarehouses });

  const createMutation = useMutation({
    mutationFn: procurementApi.createPurchaseOrder,
    onSuccess: () => {
      message.success('Purchase order created');
      setCreateModal(false);
      form.resetFields();
      setItems([{ productId: '', quantity: 1, unitCost: 0, taxRate: 0.16 }]);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: procurementApi.approvePO,
    onSuccess: () => {
      message.success('PO approved');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, items }: any) => procurementApi.receiveGoods(id, { items }),
    onSuccess: () => {
      message.success('Goods received — stock updated');
      setReceiveModal(null);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const openReceiveModal = (record: any) => {
    setReceiveModal(record);
    setReceiveItems(
      record.items.map((item: any) => ({
        productId: item.productId,
        quantityReceived: Number(item.quantity),
        warehouseId: '',
      })),
    );
  };

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      render: (v: string) => <span style={{ color: '#1677ff', fontWeight: 600 }}>{v}</span>,
    },
    { title: 'Supplier', dataIndex: ['supplier', 'name'], key: 'supplier' },
    { title: 'Date', dataIndex: 'orderDate', key: 'date', render: (v: string) => formatDate(v) },
    { title: 'Total', dataIndex: 'total', key: 'total', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'DRAFT' && (
            <Tooltip title="Approve">
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approveMutation.mutate(record.id)} />
            </Tooltip>
          )}
          {record.status === 'APPROVED' && (
            <Tooltip title="Receive Goods">
              <Button size="small" style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }} icon={<InboxOutlined />} onClick={() => openReceiveModal(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Purchase Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>New PO</Button>
      </div>

      <Card>
        <Select placeholder="Filter by status" style={{ width: 200, marginBottom: 16 }} allowClear onChange={(v) => setStatus(v)}
          options={['DRAFT', 'APPROVED', 'RECEIVED', 'VOID'].map((s) => ({ value: s, label: s }))} />
        <Table columns={columns} dataSource={data?.data || []} rowKey="id" loading={isLoading}
          pagination={{ current: page, total: data?.meta?.total || 0, pageSize: 20, onChange: setPage }} />
      </Card>

      {/* Create PO Modal */}
      <Modal title="New Purchase Order" open={createModal} onCancel={() => setCreateModal(false)}
        onOk={() => form.validateFields().then((v) => createMutation.mutate({ ...v, orderDate: v.orderDate.format('YYYY-MM-DD'), items }))}
        confirmLoading={createMutation.isPending} width={750}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="supplierId" label="Supplier" rules={[{ required: true }]}>
            <Select options={suppliers?.map((s: any) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
        <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
          {items.map((item, i) => (
            <Space key={i} style={{ width: '100%', marginBottom: 8 }}>
              <Select style={{ width: 200 }} placeholder="Product" showSearch options={products?.map((p: any) => ({ value: p.id, label: p.name }))}
                value={item.productId || undefined} onChange={(v) => { const u = [...items]; u[i].productId = v; setItems(u); }} />
              <InputNumber placeholder="Qty" min={0.01} value={item.quantity} style={{ width: 80 }}
                onChange={(v) => { const u = [...items]; u[i].quantity = v || 1; setItems(u); }} />
              <InputNumber placeholder="Unit Cost" min={0} value={item.unitCost} style={{ width: 120 }}
                onChange={(v) => { const u = [...items]; u[i].unitCost = v || 0; setItems(u); }} />
              {items.length > 1 && <Button danger size="small" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</Button>}
            </Space>
          ))}
          <Button type="dashed" block onClick={() => setItems([...items, { productId: '', quantity: 1, unitCost: 0, taxRate: 0.16 }])}>+ Add Item</Button>
        </div>
      </Modal>

      {/* Receive Goods Modal */}
      <Modal title={`Receive Goods — ${receiveModal?.orderNo}`} open={!!receiveModal}
        onCancel={() => setReceiveModal(null)}
        onOk={() => receiveMutation.mutate({ id: receiveModal?.id, items: receiveItems })}
        confirmLoading={receiveMutation.isPending} okText="Confirm Receipt">
        {receiveItems.map((item, i) => (
          <Space key={i} style={{ width: '100%', marginBottom: 8 }}>
            <span style={{ flex: 1 }}>{receiveModal?.items[i]?.product?.name}</span>
            <InputNumber placeholder="Qty Received" min={0.01} value={item.quantityReceived} style={{ width: 130 }}
              onChange={(v) => { const u = [...receiveItems]; u[i].quantityReceived = v || 0; setReceiveItems(u); }} />
            <Select placeholder="Warehouse" style={{ width: 160 }} options={warehouses?.map((w: any) => ({ value: w.id, label: w.name }))}
              value={item.warehouseId || undefined}
              onChange={(v) => { const u = [...receiveItems]; u[i].warehouseId = v; setReceiveItems(u); }} />
          </Space>
        ))}
      </Modal>
    </Space>
  );
};
