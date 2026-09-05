import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { CheckOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { procurementApi } from '../../api/procurement.api';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default', APPROVED: 'processing', PAID: 'success', VOID: 'error',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', APPROVED: 'Posted', PAID: 'Paid', VOID: 'Cancelled',
};

export const VendorBillsPage: React.FC = () => {
  const [payOpen, setPayOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [payForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: billsRes = { data: [] }, isLoading } = useQuery({
    queryKey: ['vendor-bills'],
    queryFn: () => procurementApi.getVendorBills(),
  });
  const bills: any[] = (billsRes as any).data ?? (Array.isArray(billsRes) ? billsRes : []);

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementApi.approveVendorBill(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-bills'] }); message.success('Bill validated and posted to accounting'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => procurementApi.payVendorBill(id, method),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-bills'] }); message.success('Bill paid'); setPayOpen(false); payForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Bill No.', dataIndex: 'billNumber', key: 'no', render: (v) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Vendor', key: 'vendor', render: (_, r) => r.supplier?.name },
    { title: 'Purchase Order', key: 'po', render: (_, r) => r.purchaseOrder?.orderNo ?? '—' },
    { title: 'Bill Date', key: 'date', render: (_, r) => new Date(r.billDate).toLocaleDateString() },
    { title: 'Due Date', key: 'due', render: (_, r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { title: 'Total', key: 'total', align: 'right' as const, render: (_, r) => formatCurrency(Number(r.total)) },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{STATUS_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          {r.status === 'DRAFT' && (
            <Popconfirm
              title="Validate this bill? This will post it to accounting."
              onConfirm={() => approveMutation.mutate(r.id)}
              okText="Validate"
            >
              <Button size="small" type="primary" icon={<CheckOutlined />}>Validate</Button>
            </Popconfirm>
          )}
          {r.status === 'APPROVED' && (
            <Button
              size="small"
              icon={<DollarOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
              onClick={() => { setSelectedId(r.id); setPayOpen(true); }}
            >
              Register Payment
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Vendor Bills</Title>
      </div>

      <Card>
        <Table columns={columns} dataSource={bills} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal
        title="Register Payment"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={() => payForm.submit()}
        confirmLoading={payMutation.isPending}
        destroyOnClose
      >
        <Form
          form={payForm}
          layout="vertical"
          style={{ marginTop: 12 }}
          onFinish={(v) => payMutation.mutate({ id: selectedId, method: v.paymentMethod })}
        >
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
            <Select options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'MOBILE_MONEY', label: 'Mobile Money' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default VendorBillsPage;
