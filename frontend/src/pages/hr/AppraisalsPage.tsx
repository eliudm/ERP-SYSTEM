import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Rate, Select, message,
  Typography, Card, Popconfirm,
} from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const AppraisalsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: appraisals = [], isLoading } = useQuery({
    queryKey: ['appraisals'],
    queryFn: () => hrApi.getAppraisals(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrApi.getEmployees(),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => hrApi.createAppraisal(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisals'] }); message.success('Appraisal created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => hrApi.submitAppraisal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisals'] }); message.success('Appraisal submitted'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Employee', key: 'emp', render: (_, r) => `${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.trim() },
    { title: 'Review Period', dataIndex: 'reviewPeriod', key: 'period' },
    { title: 'Rating', dataIndex: 'rating', key: 'rating', render: (v) => v ? <Rate disabled defaultValue={v} /> : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'IN_REVIEW' ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'Reviewer', key: 'reviewer', render: (_, r) => r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : '—' },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        r.status === 'DRAFT' ? (
          <Popconfirm title="Submit this appraisal?" onConfirm={() => submitMutation.mutate(r.id)} okText="Submit">
            <Button size="small" icon={<SendOutlined />}>Submit</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Appraisals</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Appraisal</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={appraisals} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Appraisal" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(employees as any[]).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
          </Form.Item>
          <Form.Item name="reviewPeriod" label="Review Period (e.g. Q1 2025)" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rating" label="Rating (1–5)"><Rate /></Form.Item>
          <Form.Item name="comments" label="Comments"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AppraisalsPage;
