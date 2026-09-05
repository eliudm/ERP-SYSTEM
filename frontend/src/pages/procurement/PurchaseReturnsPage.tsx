import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { procurementApi } from '../../api/procurement.api';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = { DRAFT: 'default', APPROVED: 'green', CANCELLED: 'red' };

export const PurchaseReturnsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: returns_ = [], isLoading } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => procurementApi.getPurchaseReturns(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => procurementApi.getSuppliers(),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => procurementApi.getPurchaseOrders(),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => procurementApi.createPurchaseReturn(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-returns'] }); message.success('Return created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementApi.approvePurchaseReturn(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-returns'] }); message.success('Return approved'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Return No.', dataIndex: 'returnNumber', key: 'no' },
    { title: 'Supplier', key: 'supplier', render: (_, r) => r.supplier?.name },
    { title: 'PO', key: 'po', render: (_, r) => r.purchaseOrder?.orderNo ?? '—' },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.returnDate).toLocaleDateString() },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'Total', key: 'total', render: (_, r) => formatCurrency(Number(r.total)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          {r.status === 'DRAFT' && (
            <Popconfirm title="Approve this return?" onConfirm={() => approveMutation.mutate(r.id)} okText="Approve">
              <Button size="small" icon={<CheckOutlined />}>Approve</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Purchase Returns</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Return</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={returns_} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Purchase Return" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="supplierId" label="Supplier" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(suppliers as any[]).map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="purchaseOrderId" label="Purchase Order (optional)">
            <Select allowClear showSearch optionFilterProp="label"
              options={(pos as any).data?.map((p: any) => ({ value: p.id, label: p.orderNo })) ?? []} />
          </Form.Item>
          <Form.Item name="returnDate" label="Return Date" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="total" label="Total Amount" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default PurchaseReturnsPage;
