import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, message,
  Typography, Card, Statistic, Row, Col, Tooltip,
} from 'antd';
import { PlusOutlined, StopOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { BankAccount } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

const bankApi = {
  getAll: async (): Promise<BankAccount[]> => (await apiClient.get('/accounting/bank-accounts')).data,
  create: async (data: any): Promise<BankAccount> => (await apiClient.post('/accounting/bank-accounts', data)).data,
  deactivate: async (id: string): Promise<BankAccount> => (await apiClient.patch(`/accounting/bank-accounts/${id}/deactivate`)).data,
  getStatements: async (id: string) => (await apiClient.get(`/accounting/bank-accounts/${id}/statements`)).data,
  createStatement: async (id: string, data: any) => (await apiClient.post(`/accounting/bank-accounts/${id}/statements`, data)).data,
  getPaymentModeReport: async (startDate: string, endDate: string, paymentMethod?: string) =>
    (
      await apiClient.get('/accounting/reports/payment-modes', {
        params: { startDate, endDate, paymentMethod },
      })
    ).data,
};

export const BankAccountsPage: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [stmtForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [reportStartDate, setReportStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reportMethod, setReportMethod] = useState<string | undefined>(
    undefined,
  );
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankApi.getAll,
  });

  const { data: statements = [] } = useQuery({
    queryKey: ['bank-statements', selectedAccount?.id],
    queryFn: () => bankApi.getStatements(selectedAccount!.id),
    enabled: !!selectedAccount,
  });

  const { data: paymentModeReport } = useQuery({
    queryKey: ['payment-mode-report', reportStartDate, reportEndDate, reportMethod],
    queryFn: () =>
      bankApi.getPaymentModeReport(reportStartDate, reportEndDate, reportMethod),
    enabled: !!reportStartDate && !!reportEndDate,
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => bankApi.create(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); message.success('Bank account created'); setCreateOpen(false); createForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => bankApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); message.success('Account deactivated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const createStmt = useMutation({
    mutationFn: (v: any) => bankApi.createStatement(selectedAccount!.id, v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-statements', selectedAccount?.id] }); message.success('Statement created'); stmtForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<BankAccount> = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v, r) => <a onClick={() => setSelectedAccount(r)}>{v}</a> },
    { title: 'Bank', dataIndex: 'bankName', key: 'bank' },
    { title: 'Account No.', dataIndex: 'accountNumber', key: 'acno' },
    { title: 'Currency', dataIndex: 'currency', key: 'currency', render: (v) => <Tag>{v}</Tag> },
    { title: 'Status', key: 'status', render: (_, r) => <Tag color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Inactive'}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Tooltip title="View Statements"><Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedAccount(r)} /></Tooltip>
          {r.isActive && (
            <Tooltip title="Deactivate">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => deactivateMutation.mutate(r.id)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const stmtColumns = [
    { title: 'Date', dataIndex: 'statementDate', key: 'date', render: (v: string) => new Date(v).toLocaleDateString() },
    { title: 'Opening Balance', key: 'opening', render: (_: any, r: any) => formatCurrency(Number(r.openingBalance)) },
    { title: 'Closing Balance', key: 'closing', render: (_: any, r: any) => formatCurrency(Number(r.closingBalance)) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'RECONCILED' ? 'green' : 'blue'}>{v}</Tag> },
    { title: 'Lines', key: 'lines', render: (_: any, r: any) => r._count?.lines ?? r.lines?.length ?? 0 },
  ];

  const paymentReportColumns = [
    { title: 'Payment Method', dataIndex: 'paymentMethod', key: 'method', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Sales Count', dataIndex: 'salesCount', key: 'salesCount' },
    { title: 'Sales Amount', dataIndex: 'salesAmount', key: 'salesAmount', render: (v: number) => formatCurrency(v) },
    { title: 'Bank Lines', dataIndex: 'bankLines', key: 'bankLines' },
    { title: 'Bank Amount', dataIndex: 'bankAmount', key: 'bankAmount', render: (v: number) => formatCurrency(v) },
    { title: 'Matched Amount', dataIndex: 'matchedBankAmount', key: 'matchedBankAmount', render: (v: number) => formatCurrency(v) },
    { title: 'Variance', dataIndex: 'variance', key: 'variance', render: (v: number) => <Text type={Math.abs(v) < 0.01 ? 'success' : 'warning'}>{formatCurrency(v)}</Text> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Bank Accounts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Account</Button>
      </div>

      <Row gutter={16}>
        {(accounts as BankAccount[]).filter((a) => a.isActive).map((a) => (
          <Col key={a.id} xs={24} sm={12} md={8}>
            <Card size="small" style={{ borderRadius: 8, cursor: 'pointer' }} onClick={() => setSelectedAccount(a)}>
              <Statistic title={a.name} value={a.bankName} suffix={<Tag>{a.currency}</Tag>} valueStyle={{ fontSize: 14 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{a.accountNumber}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Table columns={columns} dataSource={accounts as BankAccount[]} loading={isLoading} rowKey="id" size="small"
        rowClassName={(r) => r.isActive ? '' : 'ant-table-row-disabled'} />

      <Card title="Payment Mode Report vs Bank Reconciliation">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            type="date"
            value={reportStartDate}
            onChange={(e) => setReportStartDate(e.target.value)}
            style={{ width: 150 }}
          />
          <Input
            type="date"
            value={reportEndDate}
            onChange={(e) => setReportEndDate(e.target.value)}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="All payment modes"
            value={reportMethod}
            onChange={(v) => setReportMethod(v)}
            style={{ width: 180 }}
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'CARD', label: 'Card' },
              { value: 'MOBILE_MONEY', label: 'Mobile Money' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'CREDIT', label: 'Credit' },
            ]}
          />
        </Space>
        <Table
          columns={paymentReportColumns}
          dataSource={paymentModeReport?.rows ?? []}
          rowKey="paymentMethod"
          size="small"
          pagination={false}
        />
      </Card>

      {/* Statement panel */}
      {selectedAccount && (
        <Card
          title={`Statements — ${selectedAccount.name}`}
          extra={
            <Space>
              <Button icon={<PlusOutlined />} size="small" onClick={() => setStmtOpen(true)}>New Statement</Button>
              <Button size="small" onClick={() => setSelectedAccount(null)}>Close</Button>
            </Space>
          }
        >
          <Table columns={stmtColumns} dataSource={statements} rowKey="id" size="small" pagination={{ pageSize: 5 }} />
        </Card>
      )}

      {/* Create Account Modal */}
      <Modal title="New Bank Account" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label="Account Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="bankName" label="Bank Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="accountNumber" label="Account Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="currency" label="Currency" initialValue="KES">
            <Select options={[{ value: 'KES', label: 'KES' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Statement Modal */}
      <Modal title="New Bank Statement" open={stmtOpen} onCancel={() => setStmtOpen(false)} onOk={() => stmtForm.submit()}
        confirmLoading={createStmt.isPending} destroyOnClose>
        <Form form={stmtForm} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => { createStmt.mutate(v); setStmtOpen(false); }}>
          <Form.Item name="statementDate" label="Statement Date" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="openingBalance" label="Opening Balance" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="closingBalance" label="Closing Balance" rules={[{ required: true }]}><Input type="number" /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default BankAccountsPage;
