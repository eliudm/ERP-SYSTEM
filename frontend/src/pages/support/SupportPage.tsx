import React, { useState } from 'react';
import {
  Card, Table, Button, Tag, Typography, Space, Modal, Form, Input,
  Select, Badge, Drawer, message as antMessage, Row, Col, Statistic, Empty, Tooltip,
} from 'antd';
import {
  PlusOutlined, CustomerServiceOutlined, ClockCircleOutlined,
  CheckCircleOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi, type SupportTicket, type TicketMessage } from '../../api/support.api';
import { useAuthStore } from '../../store/auth.store';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'blue', IN_PROGRESS: 'processing', WAITING: 'gold',
  RESOLVED: 'success', CLOSED: 'default',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red',
};

const CATEGORIES = [
  { value: 'BILLING', label: 'Billing & Subscription' },
  { value: 'TECHNICAL', label: 'Technical Issue' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'DATA_ISSUE', label: 'Data Issue' },
  { value: 'ACCESS', label: 'Access / Permissions' },
  { value: 'OTHER', label: 'Other' },
];

export const SupportPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const { data: stats } = useQuery({ queryKey: ['support-stats'], queryFn: supportApi.getStats });
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', statusFilter],
    queryFn: () => supportApi.listTickets(1, 50, statusFilter),
  });
  const { data: ticketDetail } = useQuery({
    queryKey: ['support-ticket', activeTicket],
    queryFn: () => supportApi.getTicket(activeTicket!),
    enabled: !!activeTicket,
    refetchInterval: 15000,
  });

  const createMut = useMutation({
    mutationFn: (vals: any) => supportApi.createTicket(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-stats'] });
      setCreateOpen(false);
      form.resetFields();
      antMessage.success('Ticket submitted! We\'ll get back to you shortly.');
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed to submit ticket'),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => supportApi.addMessage(activeTicket!, content),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['support-ticket', activeTicket] });
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed to send reply'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => supportApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-ticket', activeTicket] });
      qc.invalidateQueries({ queryKey: ['support-stats'] });
    },
  });

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Support</Title>
          <Text type="secondary">Submit a ticket for technical help, billing queries, or feature requests.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Ticket</Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Open', value: stats?.open ?? 0, color: '#1677ff', icon: <CustomerServiceOutlined /> },
          { label: 'In Progress', value: stats?.inProgress ?? 0, color: '#fa8c16', icon: <ClockCircleOutlined /> },
          { label: 'Waiting Reply', value: stats?.waiting ?? 0, color: '#faad14', icon: <MessageOutlined /> },
          { label: 'Resolved', value: stats?.resolved ?? 0, color: '#52c41a', icon: <CheckCircleOutlined /> },
        ].map(s => (
          <Col xs={12} lg={6} key={s.label}>
            <Card style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title={s.label} value={s.value} prefix={s.icon} valueStyle={{ color: s.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter */}
      <div style={{ marginBottom: 12 }}>
        <Space>
          <Text type="secondary">Filter:</Text>
          {['All', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map(s => (
            <Button
              key={s}
              size="small"
              type={statusFilter === (s === 'All' ? undefined : s) || (s === 'All' && !statusFilter) ? 'primary' : 'default'}
              onClick={() => setStatusFilter(s === 'All' ? undefined : s)}
            >
              {s === 'All' ? 'All' : s.replace('_', ' ')}
            </Button>
          ))}
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={tickets?.data ?? []}
        pagination={{ pageSize: 15 }}
        size="small"
        onRow={(r) => ({ onClick: () => setActiveTicket(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Ticket #', dataIndex: 'ticketNo', render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>, width: 110 },
          { title: 'Subject', dataIndex: 'subject', render: (v: string) => <Text>{v}</Text> },
          { title: 'Category', dataIndex: 'category', render: (v: string) => <Tag>{v.replace('_', ' ')}</Tag>, width: 160 },
          { title: 'Priority', dataIndex: 'priority', render: (v: string) => <Tag color={PRIORITY_COLOR[v]}>{v}</Tag>, width: 90 },
          { title: 'Status', dataIndex: 'status', render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={v.replace('_', ' ')} />, width: 130 },
          { title: 'Messages', dataIndex: '_count', render: (v: any) => v?.messages ?? 0, width: 90, align: 'center' as const },
          { title: 'Created', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString(), width: 110 },
        ]}
      />

      {/* Create Modal */}
      <Modal open={createOpen} title="Submit Support Ticket" onCancel={() => { setCreateOpen(false); form.resetFields(); }} footer={null} width={560}>
        <Form form={form} layout="vertical" onFinish={(vals) => createMut.mutate(vals)}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true, min: 5 }]}>
            <Input placeholder="Briefly describe your issue" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label="Category" initialValue="TECHNICAL" rules={[{ required: true }]}>
                <Select options={CATEGORIES} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                <Select>
                  <Select.Option value="LOW">Low</Select.Option>
                  <Select.Option value="MEDIUM">Medium</Select.Option>
                  <Select.Option value="HIGH">High</Select.Option>
                  <Select.Option value="URGENT">Urgent</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="message" label="Describe the issue" rules={[{ required: true, min: 20, message: 'Please provide at least 20 characters' }]}>
            <TextArea rows={6} placeholder="Include: what you were doing, what you expected, what happened, and any error messages you saw." maxLength={2000} showCount />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMut.isPending}>Submit Ticket</Button>
          </div>
        </Form>
      </Modal>

      {/* Ticket Thread Drawer */}
      <Drawer
        open={!!activeTicket}
        onClose={() => setActiveTicket(null)}
        width={560}
        title={ticketDetail ? (
          <Space>
            <Text strong>{ticketDetail.ticketNo}</Text>
            <Badge status={STATUS_COLOR[ticketDetail.status] as any} text={ticketDetail.status.replace('_', ' ')} />
          </Space>
        ) : 'Loading…'}
        extra={ticketDetail && ticketDetail.status !== 'CLOSED' && ticketDetail.status !== 'RESOLVED' && (
          <Tooltip title="Mark resolved">
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => statusMut.mutate({ id: activeTicket!, status: 'RESOLVED' })}>
              Resolve
            </Button>
          </Tooltip>
        )}
      >
        {ticketDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
              <Text strong>{ticketDetail.subject}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag>{ticketDetail.category.replace('_', ' ')}</Tag>
                <Tag color={PRIORITY_COLOR[ticketDetail.priority]}>{ticketDetail.priority}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Opened {new Date(ticketDetail.createdAt).toLocaleString()}
                </Text>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {(ticketDetail.messages ?? []).length === 0 && <Empty description="No messages yet" />}
              {(ticketDetail.messages ?? []).map((m: TicketMessage) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.isStaff ? 'flex-start' : 'flex-end' }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: m.isStaff ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    background: m.isStaff ? '#f0f7ff' : '#1677ff',
                    color: m.isStaff ? '#000' : '#fff',
                    border: m.isStaff ? '1px solid #bae0ff' : 'none',
                  }}>
                    {m.isStaff && <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#1677ff' }}>Support Team</div>}
                    <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'inherit', fontSize: 13 }}>{m.content}</Paragraph>
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply */}
            {ticketDetail.status !== 'CLOSED' && ticketDetail.status !== 'RESOLVED' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <TextArea
                  rows={2}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Add a reply or more details…"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) { e.preventDefault(); replyMut.mutate(replyText.trim()); }}}
                />
                <Button
                  type="primary"
                  loading={replyMut.isPending}
                  disabled={!replyText.trim()}
                  onClick={() => replyMut.mutate(replyText.trim())}
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SupportPage;
