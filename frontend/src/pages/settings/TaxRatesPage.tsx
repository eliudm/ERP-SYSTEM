import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, InputNumber,
  Switch, Popconfirm, message, Typography, Tabs, Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxApi } from '../../api/tax.api';
import type { TaxRate, TaxGroup } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const TYPE_COLORS: Record<string, string> = { VAT: 'blue', EXCISE: 'orange', WHT: 'purple' };

export const TaxRatesPage: React.FC = () => {
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [editingGroup, setEditingGroup] = useState<TaxGroup | null>(null);
  const [rateForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: rates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: () => taxApi.getRates(undefined, false),
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['tax-groups'],
    queryFn: taxApi.getGroups,
  });

  const createRate = useMutation({
    mutationFn: (v: any) => taxApi.createRate(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-rates'] }); message.success('Rate created'); setRateModalOpen(false); rateForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });
  const updateRate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => taxApi.updateRate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-rates'] }); message.success('Rate updated'); setRateModalOpen(false); rateForm.resetFields(); setEditingRate(null); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => taxApi.setDefaultRate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-rates'] }); message.success('Set as default'); },
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => taxApi.deactivateRate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-rates'] }); message.success('Deactivated'); },
  });

  const createGroup = useMutation({
    mutationFn: (v: any) => taxApi.createGroup(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-groups'] }); message.success('Group created'); setGroupModalOpen(false); groupForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });
  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => taxApi.updateGroup(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-groups'] }); message.success('Group updated'); setGroupModalOpen(false); groupForm.resetFields(); setEditingGroup(null); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });
  const deleteGroup = useMutation({
    mutationFn: (id: string) => taxApi.deleteGroup(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tax-groups'] }); message.success('Group deleted'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const rateColumns: ColumnsType<TaxRate> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Rate', key: 'rate', render: (_, r) => `${(Number(r.rate) * 100).toFixed(2)}%` },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color={TYPE_COLORS[t] ?? 'default'}>{t}</Tag> },
    { title: 'Default', key: 'default', render: (_, r) => r.isDefault ? <Tag color="gold">Default</Tag> : null },
    { title: 'Status', key: 'status', render: (_, r) => <Tag color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Inactive'}</Tag> },
    { title: 'GL Account', key: 'gl', render: (_, r) => r.glAccount ? `${r.glAccount.code} — ${r.glAccount.name}` : '—' },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingRate(r); rateForm.setFieldsValue({ name: r.name, rate: Number(r.rate) * 100, type: r.type, isDefault: r.isDefault }); setRateModalOpen(true); }} />
          {!r.isDefault && r.isActive && (
            <Popconfirm title="Set as default for this type?" onConfirm={() => setDefault.mutate(r.id)} okText="Yes"><Button size="small" icon={<StarOutlined />} /></Popconfirm>
          )}
          {r.isActive && (
            <Popconfirm title="Deactivate this rate?" onConfirm={() => deactivate.mutate(r.id)} okText="Deactivate" okButtonProps={{ danger: true }}>
              <Button size="small" danger>Deactivate</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const groupColumns: ColumnsType<TaxGroup> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'desc', render: (v) => v || '—' },
    {
      title: 'Rates', key: 'rates', render: (_, g) =>
        (rates as TaxRate[]).filter((r) => g.taxRateIds.includes(r.id)).map((r) => (
          <Tag key={r.id} color={TYPE_COLORS[r.type]}>{r.name}</Tag>
        )),
    },
    {
      title: 'Actions', key: 'actions', render: (_, g) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingGroup(g); groupForm.setFieldsValue({ name: g.name, description: g.description, taxRateIds: g.taxRateIds }); setGroupModalOpen(true); }} />
          <Popconfirm title="Delete this group?" onConfirm={() => deleteGroup.mutate(g.id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={3} style={{ margin: 0 }}>Tax Configuration</Title>

      <Tabs
        items={[
          {
            key: 'rates',
            label: 'Tax Rates',
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRate(null); rateForm.resetFields(); setRateModalOpen(true); }}>New Rate</Button>
                </div>
                <Table columns={rateColumns} dataSource={rates as TaxRate[]} loading={ratesLoading} rowKey="id" size="small" />
              </Card>
            ),
          },
          {
            key: 'groups',
            label: 'Tax Groups',
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingGroup(null); groupForm.resetFields(); setGroupModalOpen(true); }}>New Group</Button>
                </div>
                <Table columns={groupColumns} dataSource={groups as TaxGroup[]} loading={groupsLoading} rowKey="id" size="small" />
              </Card>
            ),
          },
        ]}
      />

      {/* Rate Modal */}
      <Modal
        title={editingRate ? 'Edit Tax Rate' : 'New Tax Rate'}
        open={rateModalOpen}
        onCancel={() => { setRateModalOpen(false); setEditingRate(null); rateForm.resetFields(); }}
        onOk={() => rateForm.submit()}
        confirmLoading={createRate.isPending || updateRate.isPending}
        destroyOnClose
      >
        <Form form={rateForm} layout="vertical" style={{ marginTop: 12 }}
          onFinish={(v) => {
            const payload = { ...v, rate: Number(v.rate) / 100 };
            if (editingRate) updateRate.mutate({ id: editingRate.id, data: payload });
            else createRate.mutate(payload);
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'VAT', label: 'VAT' }, { value: 'EXCISE', label: 'Excise' }, { value: 'WHT', label: 'Withholding Tax' }]} />
          </Form.Item>
          <Form.Item name="rate" label="Rate (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isDefault" label="Set as Default" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Group Modal */}
      <Modal
        title={editingGroup ? 'Edit Tax Group' : 'New Tax Group'}
        open={groupModalOpen}
        onCancel={() => { setGroupModalOpen(false); setEditingGroup(null); groupForm.resetFields(); }}
        onOk={() => groupForm.submit()}
        confirmLoading={createGroup.isPending || updateGroup.isPending}
        destroyOnClose
      >
        <Form form={groupForm} layout="vertical" style={{ marginTop: 12 }}
          onFinish={(v) => {
            if (editingGroup) updateGroup.mutate({ id: editingGroup.id, data: v });
            else createGroup.mutate(v);
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="taxRateIds" label="Tax Rates" rules={[{ required: true, message: 'Select at least one rate' }]}>
            <Select
              mode="multiple"
              options={(rates as TaxRate[]).map((r) => ({ value: r.id, label: `${r.name} (${(Number(r.rate) * 100).toFixed(2)}%)` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default TaxRatesPage;
