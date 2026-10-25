import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, Select, InputNumber, DatePicker,
  message, Typography, Card, Row, Col, Drawer, Tabs, Empty, Modal, List, Avatar,
} from 'antd';
import {
  PlusOutlined, PhoneOutlined, MailOutlined, UserOutlined, SaveOutlined,
  BankOutlined, TeamOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { crmApi } from '../../api/crm.api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// ─── Local types ──────────────────────────────────────────────────────────────
type LeadStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
type LeadActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'NOTE';

interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  summary: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  title: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  estimatedValue: number | string | null;
  stage: LeadStage;
  probability: number;
  expectedCloseDate: string | null;
  source: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: LeadActivity[];
}

const STAGES: LeadStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

const STAGE_COLOR: Record<LeadStage, string> = {
  NEW: 'default',
  QUALIFIED: 'blue',
  PROPOSAL: 'gold',
  WON: 'green',
  LOST: 'red',
};

const ACTIVITY_TYPES: LeadActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'NOTE'];

const ACTIVITY_ICON: Record<LeadActivityType, React.ReactNode> = {
  CALL: <PhoneOutlined />,
  EMAIL: <MailOutlined />,
  MEETING: <TeamOutlined />,
  FOLLOW_UP: <UserOutlined />,
  NOTE: <FileTextOutlined />,
};

const formatMoney = (v: number | string | null | undefined) => {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// ─── Pipeline board ─────────────────────────────────────────────────────────
const PipelineBoard: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const { data: pipeline, isLoading } = useQuery<Record<LeadStage, Lead[]>>({
    queryKey: ['crm-pipeline'],
    queryFn: () => crmApi.getPipeline(),
  });

  return (
    <Card title="Pipeline" loading={isLoading}>
      <Row gutter={12}>
        {STAGES.map((stage) => {
          const leads = pipeline?.[stage] ?? [];
          const total = leads.reduce((sum, l) => sum + (parseFloat(String(l.estimatedValue ?? 0)) || 0), 0);
          return (
            <Col key={stage} xs={24} sm={12} md={Math.floor(24 / STAGES.length) || 4} style={{ minWidth: 200, flex: 1 }}>
              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: 8,
                  minHeight: 220,
                  height: '100%',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <Tag color={STAGE_COLOR[stage]} style={{ fontWeight: 600 }}>{stage}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{leads.length}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                  {formatMoney(total)}
                </Text>
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {leads.length === 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>No leads</Text>
                  )}
                  {leads.map((lead) => (
                    <Card
                      key={lead.id}
                      size="small"
                      hoverable
                      onClick={() => onOpen(lead.id)}
                      styles={{ body: { padding: 8 } }}
                    >
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{lead.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        {lead.companyName ?? lead.contactName ?? '—'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#1677ff' }}>{formatMoney(lead.estimatedValue)}</Text>
                    </Card>
                  ))}
                </Space>
              </div>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};

// ─── Add activity form ────────────────────────────────────────────────────────
const ActivityForm: React.FC<{ leadId: string }> = ({ leadId }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (v: any) => crmApi.addActivity(leadId, {
      ...v,
      dueDate: v.dueDate ? v.dueDate.toISOString() : undefined,
    }),
    onSuccess: () => {
      message.success('Activity added');
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['crm-lead', leadId] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  return (
    <Form
      form={form}
      layout="inline"
      style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
      initialValues={{ type: 'NOTE' }}
      onFinish={(v) => mutation.mutate(v)}
    >
      <Form.Item name="type" rules={[{ required: true }]}>
        <Select
          style={{ width: 130 }}
          options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
        />
      </Form.Item>
      <Form.Item name="summary" rules={[{ required: true, message: 'Summary is required' }]} style={{ flex: 1, minWidth: 200 }}>
        <Input placeholder="What happened or needs to happen…" />
      </Form.Item>
      <Form.Item name="dueDate">
        <DatePicker placeholder="Due date" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={mutation.isPending}>
          Add
        </Button>
      </Form.Item>
    </Form>
  );
};

// ─── Lead detail drawer ───────────────────────────────────────────────────────
const LeadDetailDrawer: React.FC<{ leadId: string | null; onClose: () => void }> = ({ leadId, onClose }) => {
  const qc = useQueryClient();

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['crm-lead', leadId],
    queryFn: () => crmApi.getLead(leadId!),
    enabled: !!leadId,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: LeadStage) => crmApi.updateStage(leadId!, stage),
    onSuccess: () => {
      message.success('Stage updated');
      qc.invalidateQueries({ queryKey: ['crm-lead', leadId] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const activities = lead?.activities ?? [];

  return (
    <Drawer
      title={lead?.title ?? 'Lead'}
      width={520}
      open={!!leadId}
      onClose={onClose}
      loading={isLoading}
    >
      {lead && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <Text type="secondary">Stage</Text>
                <div>
                  <Select
                    value={lead.stage}
                    style={{ width: 180, marginTop: 4 }}
                    options={STAGES.map((s) => ({ value: s, label: s }))}
                    onChange={(v) => stageMutation.mutate(v)}
                    loading={stageMutation.isPending}
                  />
                </div>
              </div>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">Company</Text>
                  <div><Text strong><BankOutlined /> {lead.companyName ?? '—'}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Contact</Text>
                  <div><Text strong><UserOutlined /> {lead.contactName ?? '—'}</Text></div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">Email</Text>
                  <div>{lead.email ?? '—'}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Phone</Text>
                  <div>{lead.phone ?? '—'}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">Estimated Value</Text>
                  <div><Text strong>{formatMoney(lead.estimatedValue)}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Probability</Text>
                  <div>{lead.probability}%</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">Expected Close</Text>
                  <div>{lead.expectedCloseDate ? dayjs(lead.expectedCloseDate).format('DD MMM YYYY') : '—'}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Source</Text>
                  <div>{lead.source ?? '—'}</div>
                </Col>
              </Row>
              {lead.notes && (
                <div>
                  <Text type="secondary">Notes</Text>
                  <div>{lead.notes}</div>
                </div>
              )}
            </Space>
          </Card>

          <Tabs
            items={[
              {
                key: 'activities',
                label: `Activities (${activities.length})`,
                children: (
                  <div>
                    <ActivityForm leadId={lead.id} />
                    {activities.length === 0 ? (
                      <Empty description="No activities yet" />
                    ) : (
                      <List
                        dataSource={activities}
                        itemLayout="horizontal"
                        renderItem={(a) => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar icon={ACTIVITY_ICON[a.type]} />}
                              title={<Space><Tag>{a.type.replace('_', ' ')}</Tag>{a.summary}</Space>}
                              description={
                                <Space size="small">
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {dayjs(a.createdAt).format('DD MMM YYYY HH:mm')}
                                  </Text>
                                  {a.dueDate && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      · Due {dayjs(a.dueDate).format('DD MMM YYYY')}
                                    </Text>
                                  )}
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Space>
      )}
    </Drawer>
  );
};

// ─── New lead modal ───────────────────────────────────────────────────────────
const NewLeadModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (v: any) => crmApi.createLead({
      ...v,
      expectedCloseDate: v.expectedCloseDate ? v.expectedCloseDate.toISOString() : undefined,
    }),
    onSuccess: () => {
      message.success('Lead created');
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      form.resetFields();
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  return (
    <Modal
      title="New Lead"
      open={open}
      onCancel={onClose}
      onOk={() => form.validateFields().then((v) => mutation.mutate(v))}
      okButtonProps={{ loading: mutation.isPending, icon: <SaveOutlined /> }}
      okText="Create"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
          <Input placeholder="e.g. Office furniture supply deal" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="companyName" label="Company">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="contactName" label="Contact Name">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="estimatedValue" label="Estimated Value">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="probability" label="Probability (%)">
              <InputNumber style={{ width: '100%' }} min={0} max={100} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="stage" label="Stage">
              <Select allowClear placeholder="NEW" options={STAGES.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expectedCloseDate" label="Expected Close">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="source" label="Source">
          <Input placeholder="e.g. Referral, Website, Cold call" />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ─── Leads list ───────────────────────────────────────────────────────────────
const LeadsList: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | undefined>(undefined);
  const [newOpen, setNewOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['crm-leads', search, stageFilter],
    queryFn: () => crmApi.getLeads(stageFilter, search || undefined),
  });

  const columns: ColumnsType<Lead> = [
    {
      title: 'Title', key: 'title',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(r.id)}>
          {r.title}
        </Button>
      ),
    },
    {
      title: 'Stage', dataIndex: 'stage', key: 'stage',
      render: (v: LeadStage) => <Tag color={STAGE_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Company', dataIndex: 'companyName', key: 'companyName',
      render: (v) => v ?? '—',
    },
    {
      title: 'Contact', dataIndex: 'contactName', key: 'contactName',
      render: (v) => v ?? '—',
    },
    {
      title: 'Value', dataIndex: 'estimatedValue', key: 'estimatedValue',
      render: (v) => formatMoney(v),
    },
    {
      title: 'Probability', dataIndex: 'probability', key: 'probability',
      render: (v) => `${v}%`,
    },
    {
      title: 'Expected Close', dataIndex: 'expectedCloseDate', key: 'expectedCloseDate',
      render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: '', key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => onOpen(r.id)}>Open</Button>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Leads</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>New Lead</Button>
      </div>

      <Space wrap>
        <Input.Search
          placeholder="Search title, company, contact, email…"
          allowClear
          style={{ width: 280 }}
          onSearch={(v) => setSearch(v)}
          onChange={(e) => !e.target.value && setSearch('')}
        />
        <Select
          allowClear
          placeholder="All stages"
          style={{ width: 160 }}
          value={stageFilter}
          onChange={(v) => setStageFilter(v)}
          options={STAGES.map((s) => ({ value: s, label: s }))}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={leads}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} leads` }}
        />
      </Card>

      <NewLeadModal open={newOpen} onClose={() => setNewOpen(false)} />
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const CrmPage: React.FC = () => {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={3} style={{ margin: 0 }}>CRM — Leads Pipeline</Title>

      <PipelineBoard onOpen={setOpenLeadId} />
      <LeadsList onOpen={setOpenLeadId} />

      <LeadDetailDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
    </Space>
  );
};

export default CrmPage;
