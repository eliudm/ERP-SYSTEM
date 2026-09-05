import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Modal, Form, Select, DatePicker, Input,
  message, Tag,
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import { formatDate, getStatusColor } from '../../utils/format';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export const LeavePage: React.FC = () => {
  const [modal, setModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leaves', statusFilter],
    queryFn: () => hrApi.getLeaveRequests(statusFilter),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrApi.getEmployees(),
  });

  const createMutation = useMutation({
    mutationFn: hrApi.createLeave,
    onSuccess: () => {
      message.success('Leave request submitted');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: hrApi.approveLeave,
    onSuccess: () => {
      message.success('Leave approved');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: hrApi.rejectLeave,
    onSuccess: () => {
      message.success('Leave rejected');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });

  const leaveTypeColors: Record<string, string> = {
    ANNUAL: 'blue', SICK: 'orange',
    MATERNITY: 'pink', PATERNITY: 'cyan', UNPAID: 'default',
  };

  const columns = [
    { title: 'Employee', dataIndex: ['employee'], key: 'emp', render: (e: any) => `${e.firstName} ${e.lastName}` },
    { title: 'Type', dataIndex: 'leaveType', key: 'type', render: (v: string) => <Tag color={leaveTypeColors[v]}>{v}</Tag> },
    { title: 'From', dataIndex: 'startDate', key: 'from', render: (v: string) => formatDate(v) },
    { title: 'To', dataIndex: 'endDate', key: 'to', render: (v: string) => formatDate(v) },
    { title: 'Days', dataIndex: 'days', key: 'days' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (v: string) => v || '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => r.status === 'PENDING' && (
        <Space>
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approveMutation.mutate(r.id)} />
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => rejectMutation.mutate(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Leave Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Request</Button>
      </div>

      <Card>
        <Select placeholder="Filter by status" style={{ width: 200, marginBottom: 16 }} allowClear
          onChange={setStatusFilter}
          options={['PENDING', 'APPROVED', 'REJECTED'].map((s) => ({ value: s, label: s }))} />
        <Table columns={columns} dataSource={leaves || []} rowKey="id" loading={isLoading} />
      </Card>

      <Modal title="New Leave Request" open={modal} onCancel={() => { setModal(false); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical"
          onFinish={(v) => createMutation.mutate({ ...v, startDate: v.dates[0].format('YYYY-MM-DD'), endDate: v.dates[1].format('YYYY-MM-DD') })}
          style={{ marginTop: 16 }}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch options={employees?.map((e: any) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))}
              filterOption={(i, o) => String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="leaveType" label="Leave Type" rules={[{ required: true }]}>
            <Select options={['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID'].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="dates" label="Date Range" rules={[{ required: true }]}>
            <RangePicker style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
          </Form.Item>
          <Form.Item name="reason" label="Reason"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
