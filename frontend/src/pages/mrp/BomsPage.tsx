import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, InputNumber, Select, message,
  Typography, Card, Modal, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mrpApi } from '../../api/mrp.api';
import type { BillOfMaterial, BOMStatus, AvailabilityResult } from '../../api/mrp.api';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<BOMStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'green',
  ARCHIVED: 'red',
};

const STATUS_OPTIONS: BOMStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

// ─── Create / Edit Modal ──────────────────────────────────────────────────
const BomFormModal: React.FC<{
  bom: BillOfMaterial | null;
  open: boolean;
  onClose: () => void;
}> = ({ bom, open, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const isEdit = !!bom;

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => inventoryApi.getProducts(),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) {
      if (bom) {
        form.setFieldsValue({
          name: bom.name,
          productId: bom.productId,
          quantity: Number(bom.quantity),
          notes: bom.notes ?? undefined,
          lines: (bom.lines ?? []).map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            notes: l.notes ?? undefined,
          })),
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ quantity: 1, lines: [{}] });
      }
    }
  }, [open, bom, form]);

  const createMutation = useMutation({
    mutationFn: (v: any) => mrpApi.boms.create(v),
    onSuccess: () => {
      message.success('BOM created');
      qc.invalidateQueries({ queryKey: ['boms'] });
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to create BOM'),
  });

  const updateMutation = useMutation({
    mutationFn: async (v: any) => {
      await mrpApi.boms.update(bom!.id, { name: v.name, quantity: v.quantity, notes: v.notes });
      return mrpApi.boms.upsertLines(bom!.id, v.lines);
    },
    onSuccess: () => {
      message.success('BOM saved');
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom', bom?.id] });
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to save BOM'),
  });

  const handleSubmit = () =>
    form.validateFields().then((values) => {
      if (isEdit) updateMutation.mutate(values);
      else createMutation.mutate(values);
    });

  const productOptions = (products as any[]).map((p) => ({
    value: p.id,
    label: `${p.code ? p.code + ' — ' : ''}${p.name}`,
  }));

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit BOM — ${bom?.name}` : 'New Bill of Materials'}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Save"
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Wooden Chair — Standard" />
        </Form.Item>
        <Space.Compact block>
          <Form.Item
            name="productId"
            label="Finished Product"
            rules={[{ required: true, message: 'Finished product is required' }]}
            style={{ width: '70%' }}
          >
            <Select
              showSearch
              disabled={isEdit}
              optionFilterProp="label"
              placeholder="Select the product this BOM produces"
              options={productOptions}
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Output Qty"
            rules={[{ required: true, message: 'Required' }]}
            style={{ width: '30%' }}
          >
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Internal notes…" />
        </Form.Item>

        <Divider titlePlacement="start" plain>Component Lines</Divider>

        <Form.List name="lines">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8, width: '100%' }}>
                  <Form.Item
                    {...rest}
                    name={[name, 'productId']}
                    rules={[{ required: true, message: 'Component required' }]}
                    style={{ width: 300, marginBottom: 0 }}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Component product"
                      options={productOptions}
                    />
                  </Form.Item>
                  <Form.Item
                    {...rest}
                    name={[name, 'quantity']}
                    rules={[{ required: true, message: 'Qty required' }]}
                    style={{ width: 120, marginBottom: 0 }}
                  >
                    <InputNumber min={0.01} placeholder="Qty" style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'notes']} style={{ width: 180, marginBottom: 0 }}>
                    <Input placeholder="Notes (optional)" />
                  </Form.Item>
                  <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                Add Component
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

// ─── Availability Modal ────────────────────────────────────────────────────
const AvailabilityModal: React.FC<{
  bom: BillOfMaterial | null;
  open: boolean;
  onClose: () => void;
}> = ({ bom, open, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<AvailabilityResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: () => mrpApi.boms.checkAvailability(bom!.id, quantity),
    onSuccess: (data) => setResult(data),
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to check availability'),
  });

  React.useEffect(() => {
    if (open) {
      setQuantity(1);
      setResult(null);
    }
  }, [open]);

  const columns: ColumnsType<AvailabilityResult['components'][number]> = [
    { title: 'Component', dataIndex: 'name', key: 'name', render: (v, r) => `${r.code} — ${v}` },
    { title: 'Required', dataIndex: 'requiredQty', key: 'requiredQty' },
    { title: 'Available', dataIndex: 'availableQty', key: 'availableQty' },
    { title: 'Shortage', dataIndex: 'shortage', key: 'shortage', render: (v) => (v > 0 ? <Text type="danger">{v}</Text> : '—') },
    {
      title: 'Status', key: 'status',
      render: (_, r) => r.isSufficient ? <Tag color="green">Sufficient</Tag> : <Tag color="red">Short</Tag>,
    },
  ];

  return (
    <Modal open={open} title={`Check Availability — ${bom?.name ?? ''}`} onCancel={onClose} footer={null} width={640}>
      <Space style={{ marginBottom: 16 }}>
        <Text>Production quantity:</Text>
        <InputNumber min={1} value={quantity} onChange={(v) => setQuantity(v ?? 1)} />
        <Button type="primary" loading={checkMutation.isPending} onClick={() => checkMutation.mutate()}>
          Check
        </Button>
      </Space>
      {result && (
        <>
          <Table
            columns={columns}
            dataSource={result.components}
            rowKey="productId"
            size="small"
            pagination={false}
          />
          <div style={{ marginTop: 12 }}>
            {result.allAvailable ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>All components available</Tag>
            ) : (
              <Tag color="red">Insufficient stock for one or more components</Tag>
            )}
          </div>
        </>
      )}
    </Modal>
  );
};

// ─── List Page ──────────────────────────────────────────────────────────────
export const BomsPage: React.FC = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BOMStatus | undefined>(undefined);
  const [formModal, setFormModal] = useState<{ open: boolean; bom: BillOfMaterial | null }>({ open: false, bom: null });
  const [availModal, setAvailModal] = useState<{ open: boolean; bom: BillOfMaterial | null }>({ open: false, bom: null });

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms', statusFilter],
    queryFn: () => mrpApi.boms.getAll(statusFilter),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BOMStatus }) => mrpApi.boms.setStatus(id, status),
    onSuccess: () => {
      message.success('Status updated');
      qc.invalidateQueries({ queryKey: ['boms'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to update status'),
  });

  const columns: ColumnsType<BillOfMaterial> = [
    {
      title: 'Name', key: 'name',
      render: (_, r) => <Text strong>{r.name}</Text>,
    },
    {
      title: 'Finished Product', key: 'product',
      render: (_, r) => r.product ? `${r.product.code} — ${r.product.name}` : '—',
    },
    {
      title: 'Output Qty', dataIndex: 'quantity', key: 'quantity',
      render: (v) => Number(v),
    },
    {
      title: 'Lines', key: 'lines',
      render: (_, r) => r._count?.lines ?? r.lines?.length ?? 0,
    },
    {
      title: 'Work Orders', key: 'workOrders',
      render: (_, r) => r._count?.workOrders ?? 0,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v: BOMStatus, r) => (
        <Select
          size="small"
          value={v}
          bordered={false}
          style={{ width: 110 }}
          onChange={(newStatus) => statusMutation.mutate({ id: r.id, status: newStatus })}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: <Tag color={STATUS_COLOR[s]} style={{ marginRight: 0 }}>{s}</Tag>,
          }))}
        />
      ),
    },
    {
      title: '', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<ExperimentOutlined />} onClick={() => setAvailModal({ open: true, bom: r })}>
            Availability
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => setFormModal({ open: true, bom: r })}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Bills of Materials</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormModal({ open: true, bom: null })}>
          New BOM
        </Button>
      </div>

      <Space wrap>
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={boms}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} BOMs` }}
        />
      </Card>

      <BomFormModal
        open={formModal.open}
        bom={formModal.bom}
        onClose={() => setFormModal({ open: false, bom: null })}
      />
      <AvailabilityModal
        open={availModal.open}
        bom={availModal.bom}
        onClose={() => setAvailModal({ open: false, bom: null })}
      />
    </Space>
  );
};

export default BomsPage;
