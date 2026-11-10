import React, { useState } from 'react';
import {
  Tabs, Card, Table, Button, Tag, Typography, Space, Modal, Form,
  Input, Select, Tooltip, Badge, Statistic, Row, Col, Progress,
  Alert, Popconfirm, message as antMessage, List, Avatar, Drawer,
  Empty, Spin,
} from 'antd';
import {
  SendOutlined, PlusOutlined, HistoryOutlined,
  MessageOutlined, WhatsAppOutlined, BellOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InboxOutlined,
  FileTextOutlined, DeleteOutlined, EditOutlined, UserOutlined,
  TeamOutlined, BarChartOutlined, FilterOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '../../api/messaging.api';
import type {
  SmsCampaign, MsgChannel, MessageThread, ThreadMessage, MessageTemplate,
  CustomerSegment, SegmentFilters, SegmentCustomer, CampaignAnalytics,
} from '../../api/messaging.api';
import { salesApi } from '../../api/sales.api';
import type { Customer } from '../../types';
import { useAuthStore } from '../../store/auth.store';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SMS_LIMIT = 160;
const WA_LIMIT = 1600;

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENDING: 'processing',
  SENT: 'success',
  FAILED: 'error',
  PENDING: 'default',
  DELIVERED: 'success',
};

function ChannelTag({ channel }: { channel: MsgChannel }) {
  return channel === 'SMS'
    ? <Tag color="blue" icon={<MessageOutlined />}>SMS</Tag>
    : <Tag color="green" icon={<WhatsAppOutlined />}>WhatsApp</Tag>;
}

// ── Campaigns tab ───────────────────────────────────────────────────────────
function CampaignsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [channel, setChannel] = useState<MsgChannel>('SMS');
  const [recipientText, setRecipientText] = useState('');
  const [msgText, setMsgText] = useState('');
  const [recipientMode, setRecipientMode] = useState<'manual' | 'segment'>('manual');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>();

  const { data: segments } = useQuery({
    queryKey: ['messaging-segments'],
    queryFn: () => messagingApi.listSegments(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['messaging-campaigns'],
    queryFn: () => messagingApi.listCampaigns(),
  });

  const detail = useQuery({
    queryKey: ['messaging-campaign', detailId],
    queryFn: () => messagingApi.getCampaign(detailId!),
    enabled: !!detailId,
  });

  const createMut = useMutation({
    mutationFn: (vals: { name: string; message: string; channel: MsgChannel }) => {
      if (recipientMode === 'segment' && selectedSegmentId) {
        return messagingApi.createCampaign({ name: vals.name, message: vals.message, channel: vals.channel, segmentId: selectedSegmentId });
      }
      const phones = recipientText.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
      return messagingApi.createCampaign({ name: vals.name, message: vals.message, channel: vals.channel, recipients: phones });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-campaigns'] });
      setCreateOpen(false);
      form.resetFields();
      setRecipientText('');
      setMsgText('');
      setSelectedSegmentId(undefined);
      setRecipientMode('manual');
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed to create campaign'),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => messagingApi.sendCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-campaigns'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['messaging-campaign', detailId] });
      antMessage.success('Campaign sent!');
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Send failed'),
  });

  const limit = channel === 'SMS' ? SMS_LIMIT : WA_LIMIT;

  const cols = [
    { title: 'Name', dataIndex: 'name', render: (v: string, r: SmsCampaign) => <Button type="link" onClick={() => setDetailId(r.id)}>{v}</Button> },
    { title: 'Channel', dataIndex: 'channel', render: (v: MsgChannel) => <ChannelTag channel={v} /> },
    { title: 'Status', dataIndex: 'status', render: (v: string) => <Badge status={statusColor[v] as any} text={v} /> },
    { title: 'Recipients', dataIndex: 'recipientCount' },
    {
      title: 'Delivery',
      render: (_: unknown, r: SmsCampaign) =>
        r.status === 'SENT' || r.status === 'FAILED'
          ? <Progress percent={Math.round((r.sentCount / (r.recipientCount || 1)) * 100)} size="small" />
          : '—',
    },
    { title: 'Sent', dataIndex: 'sentAt', render: (v: string | null) => v ? new Date(v).toLocaleString() : '—' },
    {
      title: 'Actions',
      render: (_: unknown, r: SmsCampaign) => (
        <Space>
          {r.status === 'DRAFT' && (
            <Popconfirm title="Send this campaign now?" onConfirm={() => sendMut.mutate(r.id)}>
              <Button size="small" type="primary" icon={<SendOutlined />} loading={sendMut.isPending}>Send</Button>
            </Popconfirm>
          )}
          {(r.status === 'SENT') && (
            <Button size="small" icon={<BarChartOutlined />} onClick={() => setAnalyticsId(r.id)}>Analytics</Button>
          )}
        </Space>
      ),
    },
  ];

  const detailCampaign = detail.data;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>Campaigns</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Campaign</Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={cols}
        dataSource={data?.data ?? []}
        pagination={{ pageSize: 10 }}
        size="small"
      />

      {/* Campaign analytics drawer */}
      <CampaignAnalyticsDrawer
        campaignId={analyticsId}
        open={!!analyticsId}
        onClose={() => setAnalyticsId(null)}
      />

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="New Campaign"
        onCancel={() => { setCreateOpen(false); form.resetFields(); setRecipientMode('manual'); setSelectedSegmentId(undefined); }}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createMut.mutate({ ...vals, channel })}>
          <Form.Item name="name" label="Campaign name" rules={[{ required: true }]}>
            <Input placeholder="e.g. November Promo" />
          </Form.Item>
          <Form.Item label="Channel" required>
            <Select value={channel} onChange={(v: MsgChannel) => setChannel(v)} style={{ width: 180 }}>
              <Select.Option value="SMS"><MessageOutlined /> SMS</Select.Option>
              <Select.Option value="WHATSAPP"><WhatsAppOutlined /> WhatsApp</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label={`Message (max ${limit} chars)`} required>
            <TextArea
              rows={4}
              maxLength={limit}
              showCount
              value={msgText}
              onChange={(e) => { setMsgText(e.target.value); form.setFieldValue('message', e.target.value); }}
              placeholder="Type your message here…"
            />
            <Form.Item name="message" noStyle rules={[{ required: true, message: 'Message is required' }]}>
              <input type="hidden" />
            </Form.Item>
          </Form.Item>

          <Form.Item label="Recipients">
            <Select value={recipientMode} onChange={(v: 'manual' | 'segment') => setRecipientMode(v)} style={{ marginBottom: 8 }}>
              <Select.Option value="manual">Enter phone numbers manually</Select.Option>
              <Select.Option value="segment"><TeamOutlined /> Use a saved segment</Select.Option>
            </Select>
            {recipientMode === 'manual' && (
              <>
                <TextArea
                  rows={5}
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                  placeholder={'+254722000000\n+254711000000\nor paste a comma-separated list'}
                />
                {recipientText && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {recipientText.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).length} number(s)
                  </Text>
                )}
              </>
            )}
            {recipientMode === 'segment' && (
              <Select
                placeholder="Choose a segment…"
                value={selectedSegmentId}
                onChange={setSelectedSegmentId}
                style={{ width: '100%' }}
                options={(segments ?? []).map((s: CustomerSegment) => ({
                  value: s.id,
                  label: `${s.name} (${s.customerCount} customers)`,
                }))}
              />
            )}
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMut.isPending}>Save Campaign</Button>
          </div>
        </Form>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailId}
        title={detailCampaign?.name ?? 'Campaign'}
        onCancel={() => setDetailId(null)}
        footer={
          detailCampaign?.status === 'DRAFT'
            ? <Popconfirm title="Send now?" onConfirm={() => { sendMut.mutate(detailCampaign.id); setDetailId(null); }}>
                <Button type="primary" icon={<SendOutlined />}>Send Now</Button>
              </Popconfirm>
            : null
        }
        width={700}
      >
        {detailCampaign && (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={16}>
              <Col span={6}><Statistic title="Recipients" value={detailCampaign.recipientCount} /></Col>
              <Col span={6}><Statistic title="Sent" value={detailCampaign.sentCount} styles={{ content: { color: '#52c41a' } }} /></Col>
              <Col span={6}><Statistic title="Failed" value={detailCampaign.failedCount} styles={{ content: { color: '#f5222d' } }} /></Col>
              <Col span={6}><ChannelTag channel={detailCampaign.channel} /></Col>
            </Row>
            <Card size="small" variant="outlined" styles={{ body: { background: '#f9f9f9' } }}>
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detailCampaign.message}</Paragraph>
            </Card>
            <Table
              rowKey="id"
              size="small"
              dataSource={detailCampaign.messages ?? []}
              pagination={{ pageSize: 20 }}
              columns={[
                { title: 'Recipient', dataIndex: 'recipient' },
                { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
                { title: 'Sent at', dataIndex: 'sentAt', render: (v: string | null) => v ? new Date(v).toLocaleTimeString() : '—' },
                { title: 'Error', dataIndex: 'errorMessage', render: (v: string | null) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : null },
              ]}
            />
          </Space>
        )}
      </Modal>
    </>
  );
}

// ── Payment Reminders tab ───────────────────────────────────────────────────
function RemindersTab() {
  const [channel, setChannel] = useState<MsgChannel>('SMS');
  const [selected, setSelected] = useState<string[]>([]);
  const [customMsg, setCustomMsg] = useState('');
  const [results, setResults] = useState<Array<{ name: string; phone: string; status: string }> | null>(null);

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers-credit'],
    queryFn: () => salesApi.getCustomers(),
  });

  const overdueCustomers = (customersData ?? []).filter((c: Customer) => c.phone);

  const sendMut = useMutation({
    mutationFn: () => messagingApi.sendReminders({
      customerIds: selected,
      customMessage: customMsg || undefined,
      channel,
    }),
    onSuccess: (res) => {
      setResults(res.results);
      antMessage.success('Reminders sent');
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed'),
  });

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <Alert
        type="info"
        showIcon
        message="Payment reminders are sent to selected customers with their outstanding credit balance."
      />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Text strong>Channel: </Text>
          <Select value={channel} onChange={(v: MsgChannel) => setChannel(v)} style={{ width: 160 }}>
            <Select.Option value="SMS"><MessageOutlined /> SMS</Select.Option>
            <Select.Option value="WHATSAPP"><WhatsAppOutlined /> WhatsApp</Select.Option>
          </Select>
        </div>
        <Button
          type="primary"
          icon={<BellOutlined />}
          disabled={selected.length === 0}
          loading={sendMut.isPending}
          onClick={() => sendMut.mutate()}
        >
          Send Reminders ({selected.length})
        </Button>
      </div>

      <Form.Item label="Custom message (optional — leave blank for auto-generated)">
        <TextArea
          rows={3}
          maxLength={1600}
          showCount
          value={customMsg}
          onChange={(e) => setCustomMsg(e.target.value)}
          placeholder="Dear {customer}, you have an outstanding balance of KES {amount}. Please make payment…"
        />
      </Form.Item>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={overdueCustomers}
        size="small"
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
        }}
        columns={[
          { title: 'Customer', dataIndex: 'name' },
          { title: 'Phone', dataIndex: 'phone', render: (v: string | null) => v || <Text type="secondary">No phone</Text> },
          {
            title: 'Has phone',
            dataIndex: 'phone',
            render: (v: string | null) => v
              ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
              : <CloseCircleOutlined style={{ color: '#f5222d' }} />,
          },
        ]}
      />

      {results && (
        <Card title="Results" size="small">
          {results.map((r) => (
            <div key={r.name} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
              <Text strong>{r.name}</Text>
              <Text type="secondary">{r.phone}</Text>
              <Tag color={r.status === 'SENT' ? 'success' : r.status === 'NO_PHONE' ? 'warning' : 'error'}>{r.status}</Tag>
            </div>
          ))}
        </Card>
      )}
    </Space>
  );
}

// ── History tab ─────────────────────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['messaging-messages', page],
    queryFn: () => messagingApi.listMessages(page, 50),
  });

  const cols = [
    { title: 'Recipient', dataIndex: 'recipient' },
    { title: 'Channel', dataIndex: 'channel', render: (v: MsgChannel) => <ChannelTag channel={v} /> },
    { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: 'Message', dataIndex: 'message', ellipsis: true, render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip> },
    { title: 'Sent at', dataIndex: 'sentAt', render: (v: string | null) => v ? new Date(v).toLocaleString() : '—' },
    { title: 'Error', dataIndex: 'errorMessage', render: (v: string | null) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : null },
  ];

  return (
    <Table
      rowKey="id"
      loading={isLoading}
      columns={cols}
      dataSource={data?.data ?? []}
      size="small"
      pagination={{
        current: page,
        total: data?.meta.total ?? 0,
        pageSize: 50,
        onChange: setPage,
        showTotal: (t) => `${t} messages`,
      }}
    />
  );
}

// ── Campaign Analytics Drawer ────────────────────────────────────────────────
function CampaignAnalyticsDrawer({ campaignId, open, onClose }: { campaignId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: () => messagingApi.getCampaignAnalytics(campaignId!),
    enabled: !!campaignId && open,
  });

  return (
    <Drawer title="Campaign Analytics" open={open} onClose={onClose} width={480}>
      {isLoading && <Spin style={{ display: 'block', marginTop: 60, textAlign: 'center' }} />}
      {data && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>DELIVERY</Text>
            <Row gutter={12} style={{ marginTop: 8 }}>
              <Col span={8}><Statistic title="Sent" value={data.delivery.sent} /></Col>
              <Col span={8}><Statistic title="Delivered" value={data.delivery.delivered} valueStyle={{ color: '#52c41a' }} /></Col>
              <Col span={8}><Statistic title="Failed" value={data.delivery.failed} valueStyle={{ color: '#ff4d4f' }} /></Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Delivery rate</Text>
                <Text strong>{data.delivery.deliveryRate}%</Text>
              </div>
              <Progress percent={data.delivery.deliveryRate} strokeColor="#52c41a" showInfo={false} />
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>REVENUE ATTRIBUTION ({data.revenue.attributionWindow})</Text>
            <Row gutter={12} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Statistic
                  title="Revenue Attributed"
                  value={data.revenue.attributedRevenue}
                  prefix="KES"
                  precision={2}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic title="Invoices Paid" value={data.revenue.attributedInvoices} />
              </Col>
            </Row>
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon={false}
              message={`Counts invoices paid within 30 days of campaign send by recipients of this campaign.`}
            />
          </div>
        </Space>
      )}
    </Drawer>
  );
}

// ── Segments tab ─────────────────────────────────────────────────────────────
const FILTER_LABELS: Record<keyof SegmentFilters, string> = {
  hasOverdueBalance: 'Has overdue balance',
  minOutstandingBalance: 'Min outstanding balance (KES)',
  lastPurchaseDays: 'Purchased within last N days',
  noPurchaseDays: 'No purchase in last N days (dormant)',
  minTotalOrders: 'Min total orders ever',
  creditOnly: 'Credit customers only',
  isActive: 'Active customers only',
};

function SegmentsTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSegment | null>(null);
  const [previewFilters, setPreviewFilters] = useState<SegmentFilters>({ isActive: true });
  const [form] = Form.useForm();

  const { data: segments, isLoading } = useQuery({
    queryKey: ['messaging-segments'],
    queryFn: () => messagingApi.listSegments(),
  });

  const { data: preview, isFetching: previewing, refetch: runPreview } = useQuery({
    queryKey: ['segment-preview', previewFilters],
    queryFn: () => messagingApi.previewSegment(previewFilters),
    enabled: false,
  });

  const saveMut = useMutation({
    mutationFn: (vals: any) =>
      editing
        ? messagingApi.updateSegment(editing.id, vals)
        : messagingApi.createSegment(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-segments'] });
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => messagingApi.deleteSegment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messaging-segments'] }),
  });

  const openCreate = () => { setEditing(null); form.resetFields(); setPreviewFilters({ isActive: true }); setModalOpen(true); };
  const openEdit = (s: CustomerSegment) => {
    setEditing(s);
    setPreviewFilters(s.filters);
    form.setFieldsValue({ name: s.name, description: s.description, ...s.filters });
    setModalOpen(true);
  };

  const onValuesChange = (_: any, all: any) => {
    const f: SegmentFilters = {};
    if (all.isActive !== undefined) f.isActive = all.isActive;
    if (all.creditOnly) f.creditOnly = all.creditOnly;
    if (all.hasOverdueBalance) f.hasOverdueBalance = all.hasOverdueBalance;
    if (all.minOutstandingBalance) f.minOutstandingBalance = Number(all.minOutstandingBalance);
    if (all.lastPurchaseDays) f.lastPurchaseDays = Number(all.lastPurchaseDays);
    if (all.noPurchaseDays) f.noPurchaseDays = Number(all.noPurchaseDays);
    if (all.minTotalOrders) f.minTotalOrders = Number(all.minTotalOrders);
    setPreviewFilters(f);
  };

  const handleSave = (vals: any) => {
    const { name, description, ...rest } = vals;
    const filters: SegmentFilters = {};
    if (rest.isActive !== undefined) filters.isActive = rest.isActive;
    if (rest.creditOnly) filters.creditOnly = rest.creditOnly;
    if (rest.hasOverdueBalance) filters.hasOverdueBalance = rest.hasOverdueBalance;
    if (rest.minOutstandingBalance) filters.minOutstandingBalance = Number(rest.minOutstandingBalance);
    if (rest.lastPurchaseDays) filters.lastPurchaseDays = Number(rest.lastPurchaseDays);
    if (rest.noPurchaseDays) filters.noPurchaseDays = Number(rest.noPurchaseDays);
    if (rest.minTotalOrders) filters.minTotalOrders = Number(rest.minTotalOrders);
    saveMut.mutate({ name, description, filters });
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Customer Segments</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Group customers by behaviour. Use segments to target campaigns instead of pasting phone numbers.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Segment</Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={segments ?? []}
        size="small"
        columns={[
          { title: 'Name', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
          { title: 'Description', dataIndex: 'description', render: (v: string) => v ?? '—' },
          {
            title: 'Filters',
            dataIndex: 'filters',
            render: (f: SegmentFilters) => (
              <Space wrap size={4}>
                {f.isActive && <Tag color="blue">Active only</Tag>}
                {f.creditOnly && <Tag color="purple">Credit only</Tag>}
                {f.hasOverdueBalance && <Tag color="red">Has overdue</Tag>}
                {f.minOutstandingBalance && <Tag color="orange">Balance ≥ {f.minOutstandingBalance}</Tag>}
                {f.lastPurchaseDays && <Tag color="green">Bought last {f.lastPurchaseDays}d</Tag>}
                {f.noPurchaseDays && <Tag color="default">Dormant {f.noPurchaseDays}d</Tag>}
                {f.minTotalOrders && <Tag>≥ {f.minTotalOrders} orders</Tag>}
              </Space>
            ),
          },
          {
            title: 'Customers',
            dataIndex: 'customerCount',
            render: (v: number) => <Badge count={v} showZero color="#1677ff" overflowCount={9999} />,
          },
          {
            title: 'Actions',
            render: (_: unknown, r: CustomerSegment) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
                <Popconfirm title="Delete this segment?" onConfirm={() => deleteMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Segment' : 'New Segment'}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        footer={null}
        width={720}
      >
        <Row gutter={24}>
          {/* Filter form */}
          <Col span={12}>
            <Form form={form} layout="vertical" onFinish={handleSave} onValuesChange={onValuesChange}
              initialValues={{ isActive: true }}>
              <Form.Item name="name" label="Segment name" rules={[{ required: true }]}>
                <Input placeholder="e.g. High-value credit customers" />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input placeholder="Optional note" />
              </Form.Item>
              <Form.Item name="isActive" label="Active customers only" valuePropName="checked">
                <Select>
                  <Select.Option value={true}>Yes — only active</Select.Option>
                  <Select.Option value={false}>No — include inactive</Select.Option>
                  <Select.Option value={undefined}>Any</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="creditOnly" valuePropName="checked" label="Credit customers only">
                <input type="checkbox" />
              </Form.Item>
              <Form.Item name="hasOverdueBalance" valuePropName="checked" label="Has overdue balance">
                <input type="checkbox" />
              </Form.Item>
              <Form.Item name="minOutstandingBalance" label="Min outstanding balance (KES)">
                <Input type="number" min={0} placeholder="e.g. 5000" />
              </Form.Item>
              <Form.Item name="lastPurchaseDays" label="Purchased within last N days">
                <Input type="number" min={1} placeholder="e.g. 30" />
              </Form.Item>
              <Form.Item name="noPurchaseDays" label="Dormant — no purchase in last N days">
                <Input type="number" min={1} placeholder="e.g. 90" />
              </Form.Item>
              <Form.Item name="minTotalOrders" label="Min total orders ever">
                <Input type="number" min={1} placeholder="e.g. 3" />
              </Form.Item>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button icon={<FilterOutlined />} onClick={() => runPreview()} loading={previewing}>
                  Preview
                </Button>
                <Button type="primary" htmlType="submit" loading={saveMut.isPending}>Save segment</Button>
              </div>
            </Form>
          </Col>

          {/* Preview panel */}
          <Col span={12}>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 16, minHeight: 200 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Preview</Text>
                {preview && <Badge count={preview.meta.total} showZero color="#1677ff" overflowCount={9999} />}
              </div>
              {previewing && <Spin />}
              {!previewing && preview && preview.data.length === 0 && (
                <Empty description="No customers match these filters" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              {!previewing && preview && preview.data.map((c: SegmentCustomer) => (
                <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Text style={{ fontSize: 13 }}>{c.name}</Text>
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{c.phone ?? 'No phone'}</Text></div>
                  </div>
                  {c.outstandingBalance !== undefined && c.outstandingBalance > 0 && (
                    <Tag color="orange" style={{ alignSelf: 'center' }}>
                      KES {c.outstandingBalance.toLocaleString()}
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Modal>
    </>
  );
}

// ── Inbox tab ───────────────────────────────────────────────────────────────
function InboxTab() {
  const qc = useQueryClient();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['messaging-threads'],
    queryFn: () => messagingApi.listThreads(),
    refetchInterval: 15000, // poll every 15s for new messages
  });

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['messaging-thread', activeThread],
    queryFn: () => messagingApi.getThread(activeThread!),
    enabled: !!activeThread,
    refetchInterval: 10000,
  });

  const replyMut = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      messagingApi.reply(id, content),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['messaging-thread', activeThread] });
      qc.invalidateQueries({ queryKey: ['messaging-threads'] });
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Reply failed'),
  });

  const threads = threadsData?.data ?? [];

  return (
    <div style={{ display: 'flex', gap: 0, height: 600, border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
      {/* Thread list */}
      <div style={{ width: 300, borderRight: '1px solid #f0f0f0', overflowY: 'auto', flexShrink: 0 }}>
        {isLoading && <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>}
        {!isLoading && threads.length === 0 && (
          <Empty description="No conversations yet" style={{ marginTop: 60 }} />
        )}
        {threads.map((t: MessageThread) => (
          <div
            key={t.id}
            onClick={() => setActiveThread(t.id)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: activeThread === t.id ? '#f0f7ff' : 'transparent',
              borderBottom: '1px solid #f5f5f5',
              borderLeft: activeThread === t.id ? '3px solid #1677ff' : '3px solid transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text strong style={{ flex: 1, fontSize: 13 }}>
                {t.customerName || t.customerPhone}
              </Text>
              {t.unreadCount > 0 && (
                <Badge count={t.unreadCount} size="small" />
              )}
              <ChannelTag channel={t.channel} />
            </div>
            <div style={{ marginLeft: 32 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t.messages?.[0]?.content?.slice(0, 50) ?? '—'}
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(t.lastMessageAt).toLocaleString()}
                </Text>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!activeThread && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="Select a conversation to view messages" />
          </div>
        )}
        {activeThread && (
          <>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
              <Text strong>{thread?.customerName || thread?.customerPhone}</Text>
              {thread && <ChannelTag channel={thread.channel} />}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {threadLoading && <Spin style={{ alignSelf: 'center', marginTop: 40 }} />}
              {thread?.messages?.map((m: ThreadMessage) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: m.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '8px 12px',
                    borderRadius: m.direction === 'OUTBOUND' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: m.direction === 'OUTBOUND' ? '#1677ff' : '#f0f0f0',
                    color: m.direction === 'OUTBOUND' ? '#fff' : '#000',
                  }}>
                    <div style={{ fontSize: 14 }}>{m.content}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'OUTBOUND' && (
                        <span style={{ marginLeft: 4 }}>
                          {m.status === 'SENT' ? ' ✓' : m.status === 'DELIVERED' ? ' ✓✓' : m.status === 'FAILED' ? ' ✗' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
              <Input.TextArea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a reply…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                    e.preventDefault();
                    replyMut.mutate({ id: activeThread, content: replyText.trim() });
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={replyMut.isPending}
                disabled={!replyText.trim()}
                onClick={() => replyMut.mutate({ id: activeThread, content: replyText.trim() })}
              >
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Templates tab ────────────────────────────────────────────────────────────
const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
const TEMPLATE_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

function TemplatesTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form] = Form.useForm();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['messaging-templates'],
    queryFn: () => messagingApi.listTemplates(),
  });

  const saveMut = useMutation({
    mutationFn: (vals: any) =>
      editing
        ? messagingApi.updateTemplate(editing.id, vals)
        : messagingApi.createTemplate(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-templates'] });
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => messagingApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messaging-templates'] }),
  });

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (t: MessageTemplate) => {
    setEditing(t);
    form.setFieldsValue({ name: t.name, content: t.content, category: t.category, language: t.language });
    setModalOpen(true);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>WhatsApp Message Templates</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Templates must be approved by Meta before you can send them to customers who haven't messaged you first.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Template</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Template approval"
        description="After saving a template here, submit it to Africa's Talking for Meta approval. Status will update from DRAFT → PENDING → APPROVED/REJECTED. Only APPROVED templates can be sent to new conversations."
      />

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={templates ?? []}
        size="small"
        columns={[
          { title: 'Name', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
          { title: 'Category', dataIndex: 'category', render: (v: string) => <Tag>{v}</Tag> },
          { title: 'Language', dataIndex: 'language' },
          { title: 'Status', dataIndex: 'status', render: (v: string) => <Badge status={TEMPLATE_STATUS_COLOR[v] as any} text={v} /> },
          {
            title: 'Content',
            dataIndex: 'content',
            ellipsis: true,
            render: (v: string) => <Tooltip title={v}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span></Tooltip>,
          },
          {
            title: 'Actions',
            render: (_: unknown, r: MessageTemplate) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
                <Popconfirm title="Delete this template?" onConfirm={() => deleteMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Template' : 'New Template'}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={(vals) => saveMut.mutate(vals)}>
          <Form.Item name="name" label="Template name" rules={[{ required: true }]}
            extra="Lowercase, no spaces (e.g. invoice_ready). This is what Africa's Talking registers with Meta.">
            <Input placeholder="invoice_ready" />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="UTILITY" rules={[{ required: true }]}>
            <Select>
              {CATEGORIES.map((c) => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="language" label="Language" initialValue="en" rules={[{ required: true }]}>
            <Select style={{ width: 120 }}>
              <Select.Option value="en">English</Select.Option>
              <Select.Option value="sw">Swahili</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label="Message content" rules={[{ required: true }]}
            extra="Use {{1}}, {{2}} etc. for variable placeholders (e.g. 'Hello {{1}}, your invoice {{2}} is ready.')">
            <Input.TextArea rows={5} maxLength={1024} showCount />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveMut.isPending}>Save</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export const MessagingPage: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: unreadData } = useQuery({
    queryKey: ['messaging-unread'],
    queryFn: () => messagingApi.unreadCount(),
    refetchInterval: 20000,
  });
  const unread = unreadData?.count ?? 0;

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Messaging</Title>
        <Text type="secondary">Send bulk SMS and WhatsApp messages to customers via Africa's Talking.</Text>
        {isAdmin && (
          <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Configure your API credentials in Settings → Messaging before sending." />
        )}
      </div>

      <Tabs
        defaultActiveKey="campaigns"
        items={[
          {
            key: 'campaigns',
            label: <span><SendOutlined /> Campaigns</span>,
            children: <CampaignsTab />,
          },
          {
            key: 'reminders',
            label: <span><BellOutlined /> Payment Reminders</span>,
            children: <RemindersTab />,
          },
          {
            key: 'history',
            label: <span><HistoryOutlined /> Message History</span>,
            children: <HistoryTab />,
          },
          {
            key: 'segments',
            label: <span><TeamOutlined /> Segments</span>,
            children: <SegmentsTab />,
          },
          {
            key: 'inbox',
            label: (
              <span>
                <InboxOutlined /> Inbox{unread > 0 && (
                  <Badge count={unread} size="small" style={{ marginLeft: 6 }} />
                )}
              </span>
            ),
            children: <InboxTab />,
          },
          {
            key: 'templates',
            label: <span><FileTextOutlined /> Templates</span>,
            children: <TemplatesTab />,
          },
        ]}
      />
    </div>
  );
};
