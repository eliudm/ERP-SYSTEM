import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const AttendancePage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => hrApi.getAttendance(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrApi.getEmployees(),
  });

  const checkInMutation = useMutation({
    mutationFn: (v: any) => hrApi.recordAttendance(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); message.success('Attendance recorded'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (record: any) => hrApi.checkOut(record.employeeId ?? record.employee?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); message.success('Checked out'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Employee', key: 'emp', render: (_, r) => `${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.trim() },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.date).toLocaleDateString() },
    { title: 'Check In', key: 'in', render: (_, r) => r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—' },
    { title: 'Check Out', key: 'out', render: (_, r) => r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—' },
    { title: 'Hours', key: 'hours', render: (_, r) => r.hoursWorked ? `${r.hoursWorked}h` : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'PRESENT' ? 'green' : v === 'ABSENT' ? 'red' : 'orange'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        !r.checkOut && r.checkIn ? (
          <Button size="small" onClick={() => checkOutMutation.mutate(r)}>Check Out</Button>
        ) : null
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Attendance</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Record Attendance</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={records} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="Record Attendance" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={checkInMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => checkInMutation.mutate(v)}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(employees as any[]).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AttendancePage;
