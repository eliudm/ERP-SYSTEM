import React, { useState, useEffect } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, Select, InputNumber,
  message, Typography, Card, Steps, Popconfirm, Divider, Row, Col,
  Descriptions,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SendOutlined, CheckOutlined,
  InboxOutlined, FileTextOutlined, CloseOutlined, EditOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { procurementApi } from '../../api/procurement.api';
import { inventoryApi } from '../../api/inventory.api';
import type { ColumnsType } from 'antd/es/table';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS_STEP: Record<string, number> = {
  DRAFT: 0, SENT: 1, RECEIVED: 1, CONVERTED: 2, CANCELLED: 2,
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SENT: 'processing', RECEIVED: 'warning',
  CONVERTED: 'success', CANCELLED: 'error',
};
const PO_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', APPROVED: 'processing', RECEIVED: 'success', VOID: 'error',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface LineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

// ─── Detail view component ────────────────────────────────────────────────────
const PurchaseDetail: React.FC<{
  rfqId: string | null;
  onBack: () => void;
  onSaved: () => void;
}> = ({ rfqId, onBack, onSaved }) => {
  const qc = useQueryClient();
  const isNew = rfqId === null;
  const [editing, setEditing] = useState(isNew);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<LineItem[]>([
    { productId: '', quantity: 1, unitPrice: 0, taxRate: 0.16 },
  ]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);

  const { data: rfq, isLoading } = useQuery<any>({
    queryKey: ['rfq', rfqId],
    queryFn: () => procurementApi.getRFQ(rfqId!),
    enabled: !!rfqId,
  });

  useEffect(() => {
    if (rfq) {
      form.setFieldsValue({
        supplierId: rfq.supplierId,
        vendorReference: rfq.vendorReference,
        paymentTerms: rfq.paymentTerms,
        orderDeadline: rfq.orderDeadline?.slice?.(0, 10),
        expectedArrival: rfq.expectedArrival?.slice?.(0, 10),
        deliverTo: rfq.deliverTo,
        notes: rfq.notes,
      });
      setLines(
        rfq.items.map((i: any) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.quotedPrice || i.expectedPrice || 0),
          taxRate: Number(i.taxRate || 0.16),
        })),
      );
    }
  }, [rfq, form]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => procurementApi.getSuppliers(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => inventoryApi.getProducts(),
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => procurementApi.createRFQ(v),
    onSuccess: () => {
      message.success('RFQ created');
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      onSaved();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: (v: any) => procurementApi.updateRFQ(rfqId!, v),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['rfq', rfqId] });
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      setEditing(false);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const sendMutation = useMutation({
    mutationFn: () => procurementApi.sendRFQ(rfqId!),
    onSuccess: () => { message.success('RFQ marked as Sent'); qc.invalidateQueries({ queryKey: ['rfq', rfqId] }); qc.invalidateQueries({ queryKey: ['rfqs'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => procurementApi.confirmRFQ(rfqId!),
    onSuccess: () => { message.success('Purchase Order confirmed'); qc.invalidateQueries({ queryKey: ['rfq', rfqId] }); qc.invalidateQueries({ queryKey: ['rfqs'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => procurementApi.cancelRFQ(rfqId!),
    onSuccess: () => { message.success('Cancelled'); qc.invalidateQueries({ queryKey: ['rfq', rfqId] }); qc.invalidateQueries({ queryKey: ['rfqs'] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ poId, items }: { poId: string; items: any[] }) =>
      procurementApi.receiveGoods(poId, { items }),
    onSuccess: () => {
      message.success('Products received — stock updated');
      setReceiveOpen(false);
      qc.invalidateQueries({ queryKey: ['rfq', rfqId] });
      qc.invalidateQueries({ queryKey: ['rfqs'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const createBillMutation = useMutation({
    mutationFn: (poId: string) => procurementApi.createBillFromPO(poId),
    onSuccess: (bill: any) => {
      message.success(`Vendor bill ${bill.billNumber} created — go to Vendor Bills to approve`);
      qc.invalidateQueries({ queryKey: ['rfq', rfqId] });
      qc.invalidateQueries({ queryKey: ['vendor-bills'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const handleSave = () =>
    form.validateFields().then((values) => {
      const payload = { ...values, items: lines };
      if (isNew) createMutation.mutate(payload);
      else updateMutation.mutate(payload);
    });

  const openReceive = () => {
    const po = rfq?.purchaseOrder;
    if (!po) return;
    setReceiveItems(
      po.items.map((i: any) => ({
        productId: i.productId,
        quantityReceived: Number(i.quantity),
        warehouseId: '',
        productName: i.product?.name,
      })),
    );
    setReceiveOpen(true);
  };

  // Totals
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * l.taxRate, 0);
  const grandTotal = subtotal + taxTotal;

  const status = rfq?.status ?? 'DRAFT';
  const po = rfq?.purchaseOrder;
  const isReadonly = !editing || status === 'CONVERTED' || status === 'CANCELLED';

  const stepItems = [
    { title: 'RFQ' },
    { title: 'RFQ Sent' },
    { title: 'Purchase Order' },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Orders</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? 'New — Request for Quotation' : rfq?.rfqNumber ?? '…'}
          </Title>
          {!isNew && <Tag color={STATUS_COLOR[status]}>{status.replace('_', ' ')}</Tag>}
          {po && <Tag color={PO_STATUS_COLOR[po.status]}>PO: {po.orderNo} ({po.status})</Tag>}
        </Space>

        <Space wrap>
          {/* Edit / Save (draft only) */}
          {!isNew && ['DRAFT'].includes(status) && !editing && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
          )}
          {!isNew && editing && status === 'DRAFT' && (
            <Button icon={<SaveOutlined />} onClick={handleSave} loading={updateMutation.isPending}>Save</Button>
          )}
          {isNew && (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={createMutation.isPending}>Save</Button>
          )}

          {/* Send RFQ */}
          {!isNew && status === 'DRAFT' && (
            <Popconfirm title="Send this RFQ to the vendor?" onConfirm={() => sendMutation.mutate()} okText="Send">
              <Button icon={<SendOutlined />} loading={sendMutation.isPending}>Send RFQ</Button>
            </Popconfirm>
          )}

          {/* Confirm Order */}
          {!isNew && ['DRAFT', 'SENT'].includes(status) && (
            <Popconfirm title="Confirm this order and create a Purchase Order?" onConfirm={() => confirmMutation.mutate()} okText="Confirm">
              <Button type="primary" icon={<CheckOutlined />} loading={confirmMutation.isPending}>Confirm Order</Button>
            </Popconfirm>
          )}

          {/* Receive Products */}
          {po && po.status === 'APPROVED' && (
            <Button icon={<InboxOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }} onClick={openReceive}>
              Receive Products
            </Button>
          )}

          {/* Create Vendor Bill */}
          {po && ['APPROVED', 'RECEIVED'].includes(po.status) && (
            <Popconfirm title="Create a vendor bill from this purchase order?" onConfirm={() => createBillMutation.mutate(po.id)} okText="Create Bill">
              <Button icon={<FileTextOutlined />} loading={createBillMutation.isPending}>Create Vendor Bill</Button>
            </Popconfirm>
          )}

          {/* Cancel */}
          {!isNew && ['DRAFT', 'SENT'].includes(status) && (
            <Popconfirm title="Cancel this RFQ?" onConfirm={() => cancelMutation.mutate()} okText="Cancel" okButtonProps={{ danger: true }}>
              <Button icon={<CloseOutlined />} danger>Cancel</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* ── Status steps ── */}
      {!isNew && status !== 'CANCELLED' && (
        <Steps
          current={STATUS_STEP[status] ?? 0}
          items={stepItems}
          size="small"
          style={{ maxWidth: 500 }}
        />
      )}

      {/* ── Form ── */}
      <Card loading={isLoading && !isNew}>
        <Form form={form} layout="vertical">
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <Form.Item name="supplierId" label="Vendor" rules={[{ required: true, message: 'Select a vendor' }]}>
                <Select
                  disabled={isReadonly}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Name, TIN, Email, or Reference"
                  options={(suppliers as any[]).map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
              <Form.Item name="vendorReference" label="Vendor Reference">
                <Input disabled={isReadonly} placeholder="Vendor's PO or reference number" />
              </Form.Item>
              <Form.Item name="paymentTerms" label="Payment Terms">
                <Select
                  disabled={isReadonly}
                  allowClear
                  placeholder="e.g. Net 30"
                  options={[
                    { value: 'Immediate', label: 'Immediate' },
                    { value: 'Net 15', label: 'Net 15' },
                    { value: 'Net 30', label: 'Net 30' },
                    { value: 'Net 60', label: 'Net 60' },
                    { value: 'Net 90', label: 'Net 90' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="orderDeadline" label="Order Deadline">
                <Input disabled={isReadonly} type="date" />
              </Form.Item>
              <Form.Item name="expectedArrival" label="Expected Arrival">
                <Input disabled={isReadonly} type="date" />
              </Form.Item>
              <Form.Item name="deliverTo" label="Deliver To">
                <Input disabled={isReadonly} placeholder="e.g. Main Warehouse: Receipts" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Product lines ── */}
          <Divider orientation={'left' as any} style={{ marginTop: 0 }}>Products</Divider>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500 }}>Product</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, width: 90 }}>Quantity</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, width: 130 }}>Unit Price</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, width: 110 }}>Taxes (%)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, width: 120 }}>Amount</th>
                  {!isReadonly && <th style={{ width: 40 }} />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const amount = line.quantity * line.unitPrice * (1 + line.taxRate);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 12px' }}>
                        {isReadonly ? (
                          <Text>{(products as any[]).find((p) => p.id === line.productId)?.name ?? line.productId}</Text>
                        ) : (
                          <Select
                            showSearch
                            optionFilterProp="label"
                            style={{ width: '100%', minWidth: 200 }}
                            value={line.productId || undefined}
                            placeholder="Select product"
                            options={(products as any[]).map((p) => ({ value: p.id, label: p.name }))}
                            onChange={(v) => {
                              const product = (products as any[]).find((p) => p.id === v);
                              const u = [...lines];
                              u[i] = { ...u[i], productId: v, unitPrice: product ? Number(product.unitPrice) : 0 };
                              setLines(u);
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        {isReadonly ? (
                          <Text style={{ display: 'block', textAlign: 'right' }}>{line.quantity}</Text>
                        ) : (
                          <InputNumber
                            min={0.01} value={line.quantity} style={{ width: '100%' }}
                            onChange={(v) => { const u = [...lines]; u[i].quantity = v || 1; setLines(u); }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        {isReadonly ? (
                          <Text style={{ display: 'block', textAlign: 'right' }}>{formatCurrency(line.unitPrice)}</Text>
                        ) : (
                          <InputNumber
                            min={0} value={line.unitPrice} style={{ width: '100%' }}
                            formatter={(v) => `${v}`}
                            onChange={(v) => { const u = [...lines]; u[i].unitPrice = v || 0; setLines(u); }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        {isReadonly ? (
                          <Text style={{ display: 'block', textAlign: 'right' }}>{(line.taxRate * 100).toFixed(0)}%</Text>
                        ) : (
                          <Select
                            style={{ width: '100%' }}
                            value={line.taxRate}
                            options={[
                              { value: 0, label: 'No Tax (0%)' },
                              { value: 0.08, label: 'VAT 8%' },
                              { value: 0.16, label: 'VAT 16%' },
                            ]}
                            onChange={(v) => { const u = [...lines]; u[i].taxRate = v; setLines(u); }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <Text>{formatCurrency(amount)}</Text>
                      </td>
                      {!isReadonly && (
                        <td style={{ padding: '6px 12px' }}>
                          {lines.length > 1 && (
                            <Button size="small" danger type="text" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isReadonly && (
            <Button
              type="dashed" style={{ marginTop: 8, color: '#1677ff' }}
              onClick={() => setLines([...lines, { productId: '', quantity: 1, unitPrice: 0, taxRate: 0.16 }])}
            >
              + Add a product
            </Button>
          )}

          {/* ── Totals ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ width: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text type="secondary">Untaxed Amount</Text>
                <Text>{formatCurrency(subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text type="secondary">Taxes</Text>
                <Text>{formatCurrency(taxTotal)}</Text>
              </div>
              <Divider style={{ margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text strong>Total</Text>
                <Text strong style={{ fontSize: 16 }}>{formatCurrency(grandTotal)}</Text>
              </div>
            </div>
          </div>

          <Form.Item name="notes" label="Notes" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} disabled={isReadonly} />
          </Form.Item>
        </Form>
      </Card>

      {/* ── PO Details (when confirmed) ── */}
      {po && (
        <Card title={`Purchase Order — ${po.orderNo}`} size="small">
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="Status">
              <Tag color={PO_STATUS_COLOR[po.status]}>{po.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Order Date">{new Date(po.orderDate ?? po.createdAt).toLocaleDateString()}</Descriptions.Item>
            <Descriptions.Item label="Total">{formatCurrency(Number(po.total))}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* ── Receive Products Modal ── */}
      <Modal
        title="Receive Products"
        open={receiveOpen}
        onCancel={() => setReceiveOpen(false)}
        onOk={() => po && receiveMutation.mutate({ poId: po.id, items: receiveItems })}
        confirmLoading={receiveMutation.isPending}
        okText="Confirm Receipt"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {receiveItems.map((item, i) => (
            <Card key={i} size="small" title={item.productName}>
              <Space>
                <Form.Item label="Qty Received" style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={0.01} value={item.quantityReceived}
                    onChange={(v) => { const u = [...receiveItems]; u[i].quantityReceived = v || 0; setReceiveItems(u); }}
                  />
                </Form.Item>
                <Form.Item label="Warehouse" style={{ marginBottom: 0 }}>
                  <Select
                    style={{ width: 200 }}
                    placeholder="Select warehouse"
                    value={item.warehouseId || undefined}
                    options={(warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name }))}
                    onChange={(v) => { const u = [...receiveItems]; u[i].warehouseId = v; setReceiveItems(u); }}
                  />
                </Form.Item>
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>
    </Space>
  );
};

// ─── List view component ──────────────────────────────────────────────────────
const PurchaseList: React.FC<{ onOpen: (id: string | null) => void }> = ({ onOpen }) => {
  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => procurementApi.getRFQs(),
  });

  const columns: ColumnsType<any> = [
    {
      title: 'Order / RFQ No.', key: 'no',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(r.id)}>
          {r.purchaseOrder?.orderNo ?? r.rfqNumber}
        </Button>
      ),
    },
    { title: 'Vendor', key: 'vendor', render: (_, r) => r.supplier?.name },
    {
      title: 'Status', key: 'status', render: (_, r) => (
        <Space>
          <Tag color={STATUS_COLOR[r.status]}>{r.status.replace('_', ' ')}</Tag>
          {r.purchaseOrder && (
            <Tag color={PO_STATUS_COLOR[r.purchaseOrder.status]}>PO: {r.purchaseOrder.status}</Tag>
          )}
        </Space>
      ),
    },
    { title: 'Order Deadline', key: 'deadline', render: (_, r) => r.orderDeadline ? new Date(r.orderDeadline).toLocaleDateString() : '—' },
    { title: 'Total', key: 'total', align: 'right' as const, render: (_, r) => {
        const po = r.purchaseOrder;
        if (po) return formatCurrency(Number(po.total));
        return '—';
      },
    },
    { title: 'Date', key: 'date', render: (_, r) => new Date(r.createdAt).toLocaleDateString() },
    {
      title: '', key: 'actions', render: (_, r) => (
        <Button size="small" onClick={() => onOpen(r.id)}>View</Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Requests for Quotation</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen(null)}>New</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={rfqs} loading={isLoading} rowKey="id" size="small" />
      </Card>
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const RFQPage: React.FC = () => {
  // null = list view, string = detail for that rfqId, 'new' = new form
  const [selected, setSelected] = useState<string | null | 'list'>('list');
  const qc = useQueryClient();

  const handleOpen = (id: string | null) => setSelected(id === null ? 'new' : id);
  const handleBack = () => { setSelected('list'); qc.invalidateQueries({ queryKey: ['rfqs'] }); };
  const handleSaved = () => handleBack();

  if (selected === 'list') {
    return <PurchaseList onOpen={handleOpen} />;
  }

  return (
    <PurchaseDetail
      rfqId={selected === 'new' ? null : selected}
      onBack={handleBack}
      onSaved={handleSaved}
    />
  );
};

export default RFQPage;
