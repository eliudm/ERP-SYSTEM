import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { PlusOutlined, CheckOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../../api/sales.api';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = { DRAFT: 'default', APPROVED: 'blue', APPLIED: 'green', VOID: 'red' };

export const CreditNotesPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form] = Form.useForm();
  const [applyForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: creditNotes = [], isLoading } = useQuery({
    queryKey: ['credit-notes'],
    queryFn: () => salesApi.getCreditNotes(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => salesApi.getCustomers(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => salesApi.getInvoices(),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => salesApi.createCreditNote(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-notes'] }); message.success('Credit note created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => salesApi.approveCreditNote(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-notes'] }); message.success('Credit note approved'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, invoiceId }: { id: string; invoiceId: string }) => salesApi.applyCreditNote(id, invoiceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-notes'] }); message.success('Credit note applied'); setApplyOpen(false); applyForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Credit Note No.', dataIndex: 'creditNoteNumber', key: 'no' },
    { title: 'Customer', key: 'customer', render: (_, r) => r.customer?.name },
    { title: 'Invoice', key: 'invoice', render: (_, r) => r.invoice?.invoiceNumber ?? '—' },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.creditNoteDate).toLocaleDateString() },
    { title: 'Total', key: 'total', render: (_, r) => formatCurrency(Number(r.total)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          {r.status === 'DRAFT' && (
            <Popconfirm title="Approve this credit note?" onConfirm={() => approveMutation.mutate(r.id)} okText="Approve">
              <Button size="small" icon={<CheckOutlined />}>Approve</Button>
            </Popconfirm>
          )}
          {r.status === 'APPROVED' && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => { setSelectedId(r.id); setApplyOpen(true); }}>Apply</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Credit Notes</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Credit Note</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={creditNotes} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Credit Note" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="customerId" label="Customer" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(customers as any[]).map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="invoiceId" label="Invoice (optional)">
            <Select allowClear showSearch optionFilterProp="label"
              options={(invoices as any[]).map((i: any) => ({ value: i.id, label: i.invoiceNumber }))} />
          </Form.Item>
          <Form.Item name="creditNoteDate" label="Date" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subtotal" label="Subtotal" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="taxAmount" label="Tax Amount" initialValue={0}><Input type="number" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Apply Credit Note" open={applyOpen} onCancel={() => setApplyOpen(false)}
        onOk={() => applyForm.submit()} confirmLoading={applyMutation.isPending} destroyOnClose>
        <Form form={applyForm} layout="vertical" style={{ marginTop: 12 }}
          onFinish={(v) => applyMutation.mutate({ id: selectedId, invoiceId: v.invoiceId })}>
          <Form.Item name="invoiceId" label="Apply to Invoice" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(invoices as any[]).map((i: any) => ({ value: i.id, label: i.invoiceNumber }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default CreditNotesPage;
