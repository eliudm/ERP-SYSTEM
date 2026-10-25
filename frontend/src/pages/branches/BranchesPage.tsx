import React, { useEffect, useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, message,
  Typography, Card, Row, Col, Tabs, Popconfirm, Statistic, DatePicker,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, EditOutlined, SaveOutlined,
  CloseOutlined, ShopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '../../api/branches.api';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Branch {
  id: string;
  name: string;
  code: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  warehouses?: { id: string; name: string; location: string | null }[];
  _count?: { warehouses: number; invoices: number };
}

interface BranchReport {
  branchId: string;
  period: { from: string; to: string };
  totals: { invoices: number; paidInvoices: number; revenue: number };
}

// ─── Report tab ─────────────────────────────────────────────────────────────
const BranchReportTab: React.FC<{ branchId: string }> = ({ branchId }) => {
  const now = dayjs();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([now.startOf('month'), now]);

  const { data: report, isLoading } = useQuery<BranchReport>({
    queryKey: ['branch-report', branchId, range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')],
    queryFn: () =>
      branchesApi.getBranchReport(
        branchId,
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
      ),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <RangePicker
        value={range}
        onChange={(v) => {
          if (v && v[0] && v[1]) setRange([v[0], v[1]]);
        }}
        allowClear={false}
      />
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card loading={isLoading}>
            <Statistic title="Invoices" value={report?.totals.invoices ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={isLoading}>
            <Statistic title="Paid Invoices" value={report?.totals.paidInvoices ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="Revenue"
              value={report?.totals.revenue ?? 0}
              precision={2}
              prefix="KES"
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

// ─── Detail view ─────────────────────────────────────────────────────────────
const BranchDetail: React.FC<{
  branchId: string | null;
  onBack: () => void;
  onSaved: () => void;
}> = ({ branchId, onBack, onSaved }) => {
  const qc = useQueryClient();
  const isNew = branchId === null;
  const [editing, setEditing] = useState(isNew);
  const [form] = Form.useForm();

  const { data: branch, isLoading } = useQuery<Branch>({
    queryKey: ['branch', branchId],
    queryFn: () => branchesApi.getBranch(branchId!),
    enabled: !!branchId,
  });

  useEffect(() => {
    if (branch) {
      form.setFieldsValue({
        name: branch.name,
        code: branch.code,
        location: branch.location,
      });
    }
  }, [branch, form]);

  const createMutation = useMutation({
    mutationFn: (v: any) => branchesApi.createBranch(v),
    onSuccess: () => {
      message.success('Branch created');
      qc.invalidateQueries({ queryKey: ['branches'] });
      onSaved();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: (v: any) => branchesApi.updateBranch(branchId!, v),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['branch', branchId] });
      qc.invalidateQueries({ queryKey: ['branches'] });
      setEditing(false);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const handleSave = () =>
    form.validateFields().then((values) => {
      if (isNew) createMutation.mutate(values);
      else updateMutation.mutate(values);
    });

  const isReadonly = !editing;
  const warehouses = branch?.warehouses ?? [];

  const warehouseColumns: ColumnsType<{ id: string; name: string; location: string | null }> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Location', dataIndex: 'location', key: 'location', render: (v) => v ?? '—' },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Branches</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? 'New Branch' : branch?.name ?? '…'}
          </Title>
          {!isNew && branch && (
            <Tag color={branch.isActive ? 'green' : 'red'}>{branch.isActive ? 'Active' : 'Inactive'}</Tag>
          )}
        </Space>
        <Space>
          {!isNew && !editing && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
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
        </Space>
      </div>

      <Card loading={isLoading && !isNew}>
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item name="name" label="Branch Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input disabled={isReadonly} placeholder="e.g. Nairobi CBD" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="code" label="Branch Code" rules={[{ required: true, message: 'Code is required' }]}>
                <Input disabled={isReadonly} placeholder="e.g. NRB-01" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="location" label="Location">
                <Input disabled={isReadonly} placeholder="e.g. Nairobi, Kenya" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {!isNew && (
        <Card style={{ marginTop: -16 }}>
          <Tabs
            items={[
              {
                key: 'warehouses',
                label: 'Warehouses',
                children: warehouses.length > 0 ? (
                  <Table
                    dataSource={warehouses}
                    columns={warehouseColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
                    <ShopOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                    <Text type="secondary">No active warehouses for this branch</Text>
                  </div>
                ),
              },
              {
                key: 'report',
                label: 'Performance Report',
                children: <BranchReportTab branchId={branchId!} />,
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
};

// ─── List view ────────────────────────────────────────────────────────────────
const BranchesList: React.FC<{ onOpen: (id: string | null) => void }> = ({ onOpen }) => {
  const qc = useQueryClient();

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => branchesApi.getBranches(),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => branchesApi.deactivateBranch(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); message.success('Branch deactivated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<Branch> = [
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(r.id)}>
          {r.name}
        </Button>
      ),
    },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v) => <Text code>{v}</Text> },
    { title: 'Location', dataIndex: 'location', key: 'location', render: (v) => v ?? '—' },
    {
      title: 'Warehouses',
      key: 'warehouses',
      render: (_, r) => r._count?.warehouses ?? 0,
    },
    {
      title: 'Invoices',
      key: 'invoices',
      render: (_, r) => r._count?.invoices ?? 0,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => onOpen(r.id)}>Open</Button>
          {r.isActive && (
            <Popconfirm
              title="Deactivate this branch?"
              onConfirm={() => deactivateMutation.mutate(r.id)}
              okText="Deactivate"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger>Deactivate</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Branches</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen(null)}>New</Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={branches}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} branches` }}
        />
      </Card>
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const BranchesPage: React.FC = () => {
  const [selected, setSelected] = useState<string | null | 'list'>('list');
  const qc = useQueryClient();

  const handleOpen = (id: string | null) => setSelected(id === null ? 'new' : id);
  const handleBack = () => { setSelected('list'); qc.invalidateQueries({ queryKey: ['branches'] }); };

  if (selected === 'list') return <BranchesList onOpen={handleOpen} />;

  return (
    <BranchDetail
      branchId={selected === 'new' ? null : selected}
      onBack={handleBack}
      onSaved={handleBack}
    />
  );
};

export default BranchesPage;
