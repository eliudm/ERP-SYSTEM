import React, { useMemo, useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, Select, InputNumber,
  DatePicker, Modal, Popconfirm, message, Typography, Card, Row, Col,
  Statistic, Tabs, Progress, Empty,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, DeleteOutlined, CheckCircleOutlined,
  LockOutlined, EditOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  budgetApi,
  type Budget,
  type BudgetLine,
  type BudgetStatus,
  type BudgetVsActualRow,
} from '../../api/budget.api';
import { accountingApi } from '../../api/accounting.api';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<BudgetStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'blue',
  CLOSED: 'green',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Add Line Modal ──────────────────────────────────────────────────────────
const AddLineModal: React.FC<{
  open: boolean;
  budgetId: string;
  fiscalYear: number;
  onClose: () => void;
}> = ({ open, budgetId, fiscalYear, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingApi.getAccounts(),
  });

  const addLines = useMutation({
    mutationFn: (v: { accountId: string; month: number; amount: number; notes?: string }) =>
      budgetApi.addLines(budgetId, [v]),
    onSuccess: () => {
      message.success('Line added');
      qc.invalidateQueries({ queryKey: ['budget', budgetId] });
      form.resetFields();
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error adding line'),
  });

  return (
    <Modal
      title={`Add Budget Line (FY ${fiscalYear})`}
      open={open}
      onCancel={() => { onClose(); form.resetFields(); }}
      onOk={() => form.submit()}
      confirmLoading={addLines.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => addLines.mutate(v)}>
        <Form.Item name="accountId" label="GL Account" rules={[{ required: true, message: 'Select an account' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select account"
            options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
          />
        </Form.Item>
        <Form.Item name="month" label="Month" rules={[{ required: true, message: 'Select a month' }]}>
          <Select
            placeholder="Select month"
            options={MONTH_NAMES.map((name, idx) => ({ value: idx + 1, label: name }))}
          />
        </Form.Item>
        <Form.Item name="amount" label="Budgeted Amount" rules={[{ required: true, message: 'Enter an amount' }]}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Budget vs Actual tab ────────────────────────────────────────────────────
const BudgetVsActualTab: React.FC<{ budgetId: string; enabled: boolean }> = ({ budgetId, enabled }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-vs-actual', budgetId],
    queryFn: () => budgetApi.getBudgetVsActual(budgetId),
    enabled,
  });

  const columns: ColumnsType<BudgetVsActualRow> = [
    { title: 'Code', dataIndex: 'accountCode', key: 'code', width: 100 },
    { title: 'Account', dataIndex: 'accountName', key: 'name' },
    { title: 'Type', dataIndex: 'accountType', key: 'type', render: (v) => <Tag>{v}</Tag> },
    {
      title: 'Budgeted', dataIndex: 'budgeted', key: 'budgeted', align: 'right',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Actual', dataIndex: 'actual', key: 'actual', align: 'right',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Variance', dataIndex: 'variance', key: 'variance', align: 'right',
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }} strong>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </Text>
      ),
    },
    {
      title: 'Utilization', key: 'util', width: 180,
      render: (_, r) => {
        const pct = r.budgeted !== 0 ? (r.actual / r.budgeted) * 100 : 0;
        const over = pct > 100;
        return (
          <Progress
            percent={Math.min(100, Math.round(pct))}
            status={over ? 'exception' : 'normal'}
            strokeColor={over ? '#f5222d' : pct > 85 ? '#faad14' : '#52c41a'}
            format={() => `${pct.toFixed(0)}%`}
          />
        );
      },
    },
  ];

  if (!enabled) {
    return <Empty description="Loading…" />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {data && (
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Total Budgeted" value={data.summary.totalBudgeted} formatter={(v) => formatCurrency(Number(v))} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Total Actual" value={data.summary.totalActual} formatter={(v) => formatCurrency(Number(v))} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Variance"
                value={data.summary.totalVariance}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: data.summary.totalVariance >= 0 ? '#52c41a' : '#f5222d' }}
                prefix={data.summary.totalVariance >= 0 ? <CheckCircleOutlined /> : undefined}
              />
            </Card>
          </Col>
        </Row>
      )}
      <Card title="Budget vs Actual by Account">
        <Table
          columns={columns}
          dataSource={data?.rows ?? []}
          loading={isLoading}
          rowKey="accountId"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No budget lines to compare yet' }}
        />
      </Card>
    </Space>
  );
};

// ─── Detail view ──────────────────────────────────────────────────────────────
const BudgetDetail: React.FC<{ budgetId: string | null; onBack: () => void }> = ({ budgetId, onBack }) => {
  const qc = useQueryClient();
  const isNew = budgetId === null;
  const [editing, setEditing] = useState(isNew);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lines');
  const [form] = Form.useForm();

  const { data: budget, isLoading } = useQuery({
    queryKey: ['budget', budgetId],
    queryFn: () => budgetApi.getBudget(budgetId!),
    enabled: !!budgetId,
  });

  const createMutation = useMutation({
    mutationFn: (v: any) =>
      budgetApi.createBudget({
        ...v,
        startDate: v.startDate.format('YYYY-MM-DD'),
        endDate: v.endDate.format('YYYY-MM-DD'),
      }),
    onSuccess: (created) => {
      message.success('Budget created');
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['budget', created.id] });
      onBack();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error creating budget'),
  });

  const updateMutation = useMutation({
    mutationFn: (v: any) =>
      budgetApi.updateBudget(budgetId!, {
        ...v,
        startDate: v.startDate ? v.startDate.format('YYYY-MM-DD') : undefined,
        endDate: v.endDate ? v.endDate.format('YYYY-MM-DD') : undefined,
      }),
    onSuccess: () => {
      message.success('Budget saved');
      qc.invalidateQueries({ queryKey: ['budget', budgetId] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      setEditing(false);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error saving budget'),
  });

  const setStatusMutation = useMutation({
    mutationFn: (status: BudgetStatus) => budgetApi.setStatus(budgetId!, status),
    onSuccess: (_, status) => {
      message.success(`Budget ${status === 'ACTIVE' ? 'activated' : 'closed'}`);
      qc.invalidateQueries({ queryKey: ['budget', budgetId] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error changing status'),
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => budgetApi.deleteLine(budgetId!, lineId),
    onSuccess: () => {
      message.success('Line removed');
      qc.invalidateQueries({ queryKey: ['budget', budgetId] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error removing line'),
  });

  const handleSave = () =>
    form.validateFields().then((values) => {
      if (isNew) createMutation.mutate(values);
      else updateMutation.mutate(values);
    });

  const isDraft = isNew || budget?.status === 'DRAFT';
  const isReadonly = !editing;

  const totalBudgeted = useMemo(
    () => (budget?.lines ?? []).reduce((s, l) => s + Number(l.amount), 0),
    [budget],
  );

  const lineColumns: ColumnsType<BudgetLine> = [
    { title: 'Month', dataIndex: 'month', key: 'month', width: 110, render: (m: number) => MONTH_NAMES[m - 1] },
    {
      title: 'Account', key: 'account',
      render: (_, l) => l.account ? `${l.account.code} — ${l.account.name}` : l.accountId,
    },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v) => v ?? '—' },
    {
      title: '', key: 'actions', width: 90,
      render: (_, l) => isDraft ? (
        <Popconfirm title="Remove this line?" onConfirm={() => deleteLineMutation.mutate(l.id)} okText="Remove" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ) : null,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Budgets</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? 'New Budget' : budget?.name ?? '…'}
          </Title>
          {!isNew && budget && <Tag color={STATUS_COLOR[budget.status]}>{budget.status}</Tag>}
        </Space>
        <Space>
          {!isNew && budget?.status === 'DRAFT' && !editing && (
            <Button icon={<EditOutlined />} onClick={() => {
              setEditing(true);
              form.setFieldsValue({
                name: budget.name,
                fiscalYear: budget.fiscalYear,
                startDate: dayjs(budget.startDate),
                endDate: dayjs(budget.endDate),
                notes: budget.notes,
              });
            }}>
              Edit
            </Button>
          )}
          {editing && !isNew && (
            <>
              <Button icon={<CloseOutlined />} onClick={() => { setEditing(false); form.resetFields(); }}>Discard</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={updateMutation.isPending}>Save</Button>
            </>
          )}
          {isNew && (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={createMutation.isPending}>Save</Button>
          )}
          {!isNew && budget?.status === 'DRAFT' && (
            <Popconfirm title="Activate this budget? Lines can no longer be edited once active." onConfirm={() => setStatusMutation.mutate('ACTIVE')} okText="Activate">
              <Button icon={<CheckCircleOutlined />}>Activate</Button>
            </Popconfirm>
          )}
          {!isNew && budget?.status === 'ACTIVE' && (
            <Popconfirm title="Close this budget? This cannot be undone." onConfirm={() => setStatusMutation.mutate('CLOSED')} okText="Close" okButtonProps={{ danger: true }}>
              <Button icon={<LockOutlined />} danger>Close</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Card loading={isLoading && !isNew}>
        <Form form={form} layout="vertical" initialValues={{ fiscalYear: dayjs().year() }}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Budget Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input disabled={isReadonly} placeholder="e.g. Operating Budget" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="fiscalYear" label="Fiscal Year" rules={[{ required: true, message: 'Fiscal year is required' }]}>
                <InputNumber disabled={isReadonly} style={{ width: '100%' }} min={2000} max={2100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="startDate" label="Start Date" rules={[{ required: true, message: 'Start date is required' }]}>
                <DatePicker disabled={isReadonly} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="endDate" label="End Date" rules={[{ required: true, message: 'End date is required' }]}>
                <DatePicker disabled={isReadonly} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea disabled={isReadonly} rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {!isNew && budget && (
        <Card style={{ marginTop: -16 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'lines',
                label: `Lines (${budget.lines.length})`,
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary">Total budgeted: <Text strong>{formatCurrency(totalBudgeted)}</Text></Text>
                      {isDraft && (
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddLineOpen(true)}>
                          Add Line
                        </Button>
                      )}
                    </div>
                    <Table
                      columns={lineColumns}
                      dataSource={budget.lines}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 12, showSizeChanger: false }}
                      locale={{ emptyText: 'No budget lines yet' }}
                    />
                  </Space>
                ),
              },
              {
                key: 'vsActual',
                label: 'vs Actual',
                children: <BudgetVsActualTab budgetId={budget.id} enabled={activeTab === 'vsActual'} />,
              },
            ]}
          />
        </Card>
      )}

      {!isNew && budget && (
        <AddLineModal
          open={addLineOpen}
          budgetId={budget.id}
          fiscalYear={budget.fiscalYear}
          onClose={() => setAddLineOpen(false)}
        />
      )}
    </Space>
  );
};

// ─── List view ────────────────────────────────────────────────────────────────
const BudgetsList: React.FC<{ onOpen: (id: string | null) => void }> = ({ onOpen }) => {
  const [fiscalYear, setFiscalYear] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<BudgetStatus | undefined>(undefined);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', fiscalYear, status],
    queryFn: () => budgetApi.getBudgets(fiscalYear, status),
  });

  const columns: ColumnsType<Budget> = [
    {
      title: 'Name', key: 'name',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(r.id)}>
          {r.name}
        </Button>
      ),
    },
    { title: 'Fiscal Year', dataIndex: 'fiscalYear', key: 'fiscalYear', width: 120 },
    {
      title: 'Period', key: 'period',
      render: (_, r) => `${dayjs(r.startDate).format('MMM D, YYYY')} – ${dayjs(r.endDate).format('MMM D, YYYY')}`,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v: BudgetStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Lines', key: 'lines', width: 90, align: 'center',
      render: (_, r) => r._count?.lines ?? r.lines?.length ?? 0,
    },
    {
      title: '', key: 'actions', width: 100,
      render: (_, r) => <Button size="small" onClick={() => onOpen(r.id)}>Open</Button>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Budgets</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen(null)}>New Budget</Button>
      </div>

      <Space wrap>
        <InputNumber
          placeholder="Fiscal year"
          style={{ width: 140 }}
          value={fiscalYear}
          onChange={(v) => setFiscalYear(v ?? undefined)}
        />
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={status}
          onChange={(v) => setStatus(v)}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={budgets}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} budgets` }}
        />
      </Card>
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const BudgetsPage: React.FC = () => {
  const [selected, setSelected] = useState<string | null | 'list'>('list');
  const qc = useQueryClient();

  const handleOpen = (id: string | null) => setSelected(id === null ? 'new' : id);
  const handleBack = () => { setSelected('list'); qc.invalidateQueries({ queryKey: ['budgets'] }); };

  if (selected === 'list') return <BudgetsList onOpen={handleOpen} />;

  return (
    <BudgetDetail
      budgetId={selected === 'new' ? null : selected}
      onBack={handleBack}
    />
  );
};

export default BudgetsPage;
