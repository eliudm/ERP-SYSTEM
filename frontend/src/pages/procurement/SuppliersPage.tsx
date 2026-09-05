import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Input, Modal, Form, message, Tag,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { procurementApi } from '../../api/procurement.api';

const { Title } = Typography;
const { Search } = Input;

export const SuppliersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => procurementApi.getSuppliers(search),
  });

  const createMutation = useMutation({
    mutationFn: procurementApi.createSupplier,
    onSuccess: () => {
      message.success('Supplier created');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed');
    },
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v: string) => v || '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '—' },
    { title: 'KRA PIN', dataIndex: 'taxPin', key: 'pin', render: (v: string) => v || '—' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Suppliers</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Supplier</Button>
      </div>
      <Card>
        <Search placeholder="Search..." prefix={<SearchOutlined />} style={{ width: 300, marginBottom: 16 }} onSearch={setSearch} onChange={(e) => !e.target.value && setSearch('')} />
        <Table columns={columns} dataSource={suppliers || []} rowKey="id" loading={isLoading} />
      </Card>
      <Modal title="New Supplier" open={modal} onCancel={() => { setModal(false); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={createMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="taxPin" label="KRA PIN"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
