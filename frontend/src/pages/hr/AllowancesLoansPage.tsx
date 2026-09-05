import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Tabs, Popconfirm, Switch,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title } = Typography;

export const AllowancesLoansPage: React.FC = () => {
  const [allowanceOpen, setAllowanceOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [allowanceForm] = Form.useForm();
  const [loanForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrApi.getEmployees(),
  });

  const { data: allowances = [], isLoading: loadingA } = useQuery({
    queryKey: ['allowances'],
    queryFn: () => hrApi.getAllowances(),
  });

  const { data: loans = [], isLoading: loadingL } = useQuery({
    queryKey: ['loans'],
    queryFn: () => hrApi.getLoans(),
  });

  const createAllowanceMutation = useMutation({
    mutationFn: (v: any) => hrApi.createAllowance(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allowances'] }); message.success('Allowance created'); setAllowanceOpen(false); allowanceForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const deleteAllowanceMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteAllowance(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allowances'] }); message.success('Allowance removed'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const createLoanMutation = useMutation({
    mutationFn: (v: any) => hrApi.createLoan(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); message.success('Loan created'); setLoanOpen(false); loanForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const allowanceCols: ColumnsType<any> = [
    { title: 'Employee', key: 'emp', render: (_, r) => `${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.trim() },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Amount', key: 'amount', render: (_, r) => formatCurrency(Number(r.amount)) },
    { title: 'Recurring', dataIndex: 'isRecurring', key: 'recurring', render: (v) => <Switch checked={v} disabled size="small" /> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Popconfirm title="Remove allowance?" onConfirm={() => deleteAllowanceMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const loanCols: ColumnsType<any> = [
    { title: 'Employee', key: 'emp', render: (_, r) => `${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.trim() },
    { title: 'Principal', key: 'principal', render: (_, r) => formatCurrency(Number(r.principal)) },
    { title: 'Monthly Deduction', key: 'monthly', render: (_, r) => formatCurrency(Number(r.monthlyDeduction)) },
    { title: 'Balance', key: 'balance', render: (_, r) => formatCurrency(Number(r.remainingBalance)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'PAID' ? 'green' : 'blue'}>{v}</Tag> },
  ];

  const empOptions = (employees as any[]).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={3} style={{ margin: 0 }}>Allowances & Loans</Title>

      <Tabs
        items={[
          {
            key: 'allowances',
            label: 'Allowances',
            children: (
              <Card
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAllowanceOpen(true)}>Add Allowance</Button>}
              >
                <Table columns={allowanceCols} dataSource={allowances} loading={loadingA} rowKey="id" size="small" />
              </Card>
            ),
          },
          {
            key: 'loans',
            label: 'Loans & Deductions',
            children: (
              <Card
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setLoanOpen(true)}>Add Loan</Button>}
              >
                <Table columns={loanCols} dataSource={loans} loading={loadingL} rowKey="id" size="small" />
              </Card>
            ),
          },
        ]}
      />

      <Modal title="Add Allowance" open={allowanceOpen} onCancel={() => { setAllowanceOpen(false); allowanceForm.resetFields(); }}
        onOk={() => allowanceForm.submit()} confirmLoading={createAllowanceMutation.isPending} destroyOnClose>
        <Form form={allowanceForm} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createAllowanceMutation.mutate(v)}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={empOptions} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'HOUSING', label: 'Housing' }, { value: 'TRANSPORT', label: 'Transport' }, { value: 'MEDICAL', label: 'Medical' }, { value: 'OTHER', label: 'Other' }]} />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="isRecurring" label="Recurring" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Loan / Deduction" open={loanOpen} onCancel={() => { setLoanOpen(false); loanForm.resetFields(); }}
        onOk={() => loanForm.submit()} confirmLoading={createLoanMutation.isPending} destroyOnClose>
        <Form form={loanForm} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createLoanMutation.mutate(v)}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={empOptions} />
          </Form.Item>
          <Form.Item name="principal" label="Loan Amount" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="monthlyDeduction" label="Monthly Deduction" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AllowancesLoansPage;
