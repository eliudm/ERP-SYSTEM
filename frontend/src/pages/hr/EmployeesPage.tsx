import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Input, Modal, Form, InputNumber, DatePicker,
  message, Tag, Row, Col, Statistic,
} from 'antd';
import { PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import { formatCurrency, formatDate } from '../../utils/format';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

export const EmployeesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: () => hrApi.getEmployees(search),
  });

  const { data: headcount } = useQuery({
    queryKey: ['headcount'],
    queryFn: hrApi.getHeadcount,
  });

  const createMutation = useMutation({
    mutationFn: hrApi.createEmployee,
    onSuccess: () => {
      message.success('Employee created');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['headcount'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const columns = [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'empNo', width: 110 },
    { title: 'Name', key: 'name', render: (_: any, r: any) => `${r.firstName} ${r.lastName}` },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Department', dataIndex: 'department', key: 'dept', render: (v: string) => v || '—' },
    { title: 'Position', dataIndex: 'position', key: 'pos', render: (v: string) => v || '—' },
    { title: 'Salary', dataIndex: 'salary', key: 'salary', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Start Date', dataIndex: 'startDate', key: 'start', render: (v: string) => formatDate(v) },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === 'ACTIVE' ? 'green' : v === 'TERMINATED' ? 'red' : 'orange'}>{v}</Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Employees</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Employee</Button>
      </div>

      {headcount && (
        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="Total Active" value={headcount.active} prefix={<TeamOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Inactive" value={headcount.inactive} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Terminated" value={headcount.terminated} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Total" value={headcount.total} /></Card></Col>
        </Row>
      )}

      <Card>
        <Search placeholder="Search employees..." prefix={<SearchOutlined />} style={{ width: 300, marginBottom: 16 }} onSearch={setSearch} onChange={(e) => !e.target.value && setSearch('')} />
        <Table columns={columns} dataSource={employees || []} rowKey="id" loading={isLoading} />
      </Card>

      <Modal title="New Employee" open={modal} onCancel={() => { setModal(false); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={createMutation.isPending} width={600}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate({ ...v, startDate: v.startDate.format('YYYY-MM-DD') })} style={{ marginTop: 16 }}>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="firstName" label="First Name" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          </Space>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="department" label="Department" style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="position" label="Position" style={{ flex: 1 }}><Input /></Form.Item>
          </Space>
          <Form.Item name="salary" label="Gross Salary (KES)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
