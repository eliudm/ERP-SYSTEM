import React, { useState, useEffect } from 'react';
import {
  Button, Table, Tag, Space, Form, Input, Select, message,
  Typography, Card, Avatar, Row, Col, Tabs, Divider, Popconfirm, Badge,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, EditOutlined, SaveOutlined,
  UserOutlined, BankOutlined, MailOutlined, PhoneOutlined,
  GlobalOutlined, EnvironmentOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../api/contacts.api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Link } = Typography;

const TYPE_COLOR: Record<string, string> = {
  COMPANY: 'blue',
  INDIVIDUAL: 'default',
};

const PARTNER_LEVELS = ['Gold', 'Silver', 'Bronze', 'Standard'];

// ─── Detail Form ─────────────────────────────────────────────────────────────
const ContactDetail: React.FC<{
  contactId: string | null;
  onBack: () => void;
  onSaved: () => void;
}> = ({ contactId, onBack, onSaved }) => {
  const qc = useQueryClient();
  const isNew = contactId === null;
  const [editing, setEditing] = useState(isNew);
  const [form] = Form.useForm();

  const { data: contact, isLoading } = useQuery<any>({
    queryKey: ['contact', contactId],
    queryFn: () => contactsApi.getContact(contactId!),
    enabled: !!contactId,
  });

  useEffect(() => {
    if (contact) {
      form.setFieldsValue({
        type: contact.type,
        name: contact.name,
        companyId: contact.companyId,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
        website: contact.website,
        street: contact.street,
        street2: contact.street2,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
        country: contact.country,
        taxId: contact.taxId,
        jobPosition: contact.jobPosition,
        partnerLevel: contact.partnerLevel,
        tags: contact.tags ?? [],
        notes: contact.notes,
      });
    }
  }, [contact, form]);

  const { data: companies = [] } = useQuery({
    queryKey: ['contact-companies'],
    queryFn: () => contactsApi.getCompanies(),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => contactsApi.createContact(v),
    onSuccess: () => {
      message.success('Contact created');
      qc.invalidateQueries({ queryKey: ['contacts'] });
      onSaved();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: (v: any) => contactsApi.updateContact(contactId!, v),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['contact', contactId] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setEditing(false);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const handleSave = () =>
    form.validateFields().then((values) => {
      if (isNew) createMutation.mutate(values);
      else updateMutation.mutate(values);
    });

  const typeValue = Form.useWatch('type', form) ?? (contact?.type ?? 'INDIVIDUAL');
  const isReadonly = !editing;

  const subContacts: any[] = contact?.contacts ?? [];

  const subColumns: ColumnsType<any> = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <Text strong>{v}</Text> },
    { title: 'Job Position', dataIndex: 'jobPosition', key: 'pos', render: (v) => v ?? '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => v ? <Link href={`mailto:${v}`}>{v}</Link> : '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v) => v ?? '—' },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Contacts</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? 'New Contact' : contact?.name ?? '…'}
          </Title>
          {!isNew && contact && (
            <Tag color={TYPE_COLOR[contact.type]}>{contact.type}</Tag>
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

      {/* ── Main Card ── */}
      <Card loading={isLoading && !isNew}>
        <Form form={form} layout="vertical" initialValues={{ type: 'INDIVIDUAL', tags: [] }}>
          {/* Top hero section */}
          <Row gutter={24} align="top">
            {/* Avatar / logo */}
            <Col flex="120px">
              <Avatar
                size={100}
                icon={typeValue === 'COMPANY' ? <BankOutlined /> : <UserOutlined />}
                style={{ background: typeValue === 'COMPANY' ? '#1677ff22' : '#52c41a22', color: typeValue === 'COMPANY' ? '#1677ff' : '#52c41a', fontSize: 42, borderRadius: 8 }}
                shape="square"
              />
            </Col>
            {/* Name + company + contact info */}
            <Col flex="1">
              <Form.Item name="type" noStyle>
                <Select
                  disabled={isReadonly}
                  bordered={false}
                  style={{ fontSize: 12, marginBottom: 4 }}
                  options={[
                    { value: 'INDIVIDUAL', label: 'Individual' },
                    { value: 'COMPANY', label: 'Company' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="name" rules={[{ required: true, message: 'Name is required' }]} style={{ marginBottom: 8 }}>
                <Input
                  disabled={isReadonly}
                  bordered={!isReadonly}
                  placeholder="Name (company or person)"
                  style={{ fontSize: 28, fontWeight: 600, color: '#111', padding: isReadonly ? 0 : undefined }}
                />
              </Form.Item>
              {typeValue === 'INDIVIDUAL' && (
                <Form.Item name="companyId" style={{ marginBottom: 6 }}>
                  <Select
                    disabled={isReadonly}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    bordered={!isReadonly}
                    placeholder="Company Employer"
                    options={(companies as any[]).map((c) => ({ value: c.id, label: c.name }))}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
              <Form.Item name="email" style={{ marginBottom: 6 }}>
                <Input
                  disabled={isReadonly}
                  bordered={!isReadonly}
                  prefix={<MailOutlined style={{ color: '#aaa' }} />}
                  placeholder="Email"
                />
              </Form.Item>
              <Form.Item name="phone" style={{ marginBottom: 0 }}>
                <Input
                  disabled={isReadonly}
                  bordered={!isReadonly}
                  prefix={<PhoneOutlined style={{ color: '#aaa' }} />}
                  placeholder="Phone"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          {/* Address + right panel */}
          <Row gutter={48}>
            <Col xs={24} md={12}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>
                <EnvironmentOutlined /> Address
              </div>
              <Form.Item name="street">
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="Street…" />
              </Form.Item>
              <Form.Item name="street2">
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="Street 2…" />
              </Form.Item>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item name="city">
                    <Input disabled={isReadonly} bordered={!isReadonly} placeholder="City" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="state">
                    <Input disabled={isReadonly} bordered={!isReadonly} placeholder="State" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="zip">
                    <Input disabled={isReadonly} bordered={!isReadonly} placeholder="ZIP" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="country">
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="Country" />
              </Form.Item>
              <Form.Item name="taxId" label={<span style={{ fontWeight: 600 }}>Tax ID</span>}>
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="e.g. KRA PIN" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="jobPosition" label={<span style={{ fontWeight: 600 }}>Job Position</span>}>
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="e.g. Sales Director" />
              </Form.Item>
              <Form.Item name="mobile" label={<span style={{ fontWeight: 600 }}>Mobile</span>}>
                <Input disabled={isReadonly} bordered={!isReadonly} placeholder="Mobile number" />
              </Form.Item>
              <Form.Item name="website" label={<span style={{ fontWeight: 600 }}>Website</span>}>
                <Input
                  disabled={isReadonly}
                  bordered={!isReadonly}
                  prefix={<GlobalOutlined style={{ color: '#aaa' }} />}
                  placeholder="e.g. https://www.example.com"
                />
              </Form.Item>
              <Form.Item name="partnerLevel" label={<span style={{ fontWeight: 600 }}>Partner Level</span>}>
                <Select
                  disabled={isReadonly}
                  allowClear
                  bordered={!isReadonly}
                  placeholder="Select level"
                  options={PARTNER_LEVELS.map((l) => ({ value: l, label: l }))}
                />
              </Form.Item>
              <Form.Item name="tags" label={<span style={{ fontWeight: 600 }}>Tags</span>}>
                <Select
                  disabled={isReadonly}
                  mode="tags"
                  bordered={!isReadonly}
                  placeholder={`e.g. "B2B", "VIP", "Consulting", …`}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ── Tabs ── */}
      {!isNew && (
        <Card style={{ marginTop: -16 }}>
          <Tabs
            items={[
              {
                key: 'contacts',
                label: 'Contacts',
                children: (
                  <div>
                    {subContacts.length > 0 ? (
                      <Table
                        dataSource={subContacts}
                        columns={subColumns}
                        rowKey="id"
                        size="small"
                        pagination={false}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
                        <UserOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                        <Text type="secondary">No sub-contacts yet</Text>
                      </div>
                    )}
                    {editing && (
                      <Button
                        type="dashed"
                        style={{ marginTop: 12, color: '#1677ff' }}
                        icon={<PlusOutlined />}
                        onClick={() => {
                          /* future: open a quick-add sub-contact modal */
                          message.info('Save the contact first, then add sub-contacts from the list view');
                        }}
                      >
                        Add Contact
                      </Button>
                    )}
                  </div>
                ),
              },
              {
                key: 'notes',
                label: 'Notes',
                children: (
                  <Form form={form} layout="vertical">
                    <Form.Item name="notes">
                      <Input.TextArea
                        rows={5}
                        disabled={isReadonly}
                        placeholder="Internal notes about this contact…"
                      />
                    </Form.Item>
                    {editing && (
                      <Button type="primary" size="small" onClick={handleSave} loading={updateMutation.isPending}>
                        Save Notes
                      </Button>
                    )}
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
};

// ─── List view ────────────────────────────────────────────────────────────────
const ContactsList: React.FC<{ onOpen: (id: string | null) => void }> = ({ onOpen }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search, typeFilter],
    queryFn: () => contactsApi.getContacts(search || undefined, typeFilter),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.deleteContact(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); message.success('Contact archived'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    {
      title: 'Name', key: 'name',
      render: (_, r) => (
        <Space>
          <Avatar
            size="small"
            icon={r.type === 'COMPANY' ? <BankOutlined /> : <UserOutlined />}
            style={{ background: r.type === 'COMPANY' ? '#1677ff22' : '#f0f0f0', color: r.type === 'COMPANY' ? '#1677ff' : '#888' }}
          />
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(r.id)}>
            {r.name}
          </Button>
          {r._count?.contacts > 0 && (
            <Badge count={r._count.contacts} size="small" style={{ background: '#1677ff' }} />
          )}
        </Space>
      ),
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (v) => <Tag color={TYPE_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Company', key: 'company',
      render: (_, r) => r.company?.name ?? '—',
    },
    {
      title: 'Phone', dataIndex: 'phone', key: 'phone',
      render: (v) => v ?? '—',
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email',
      render: (v) => v ? <Link href={`mailto:${v}`}>{v}</Link> : '—',
    },
    {
      title: 'City', dataIndex: 'city', key: 'city',
      render: (v) => v ?? '—',
    },
    {
      title: 'Tags', dataIndex: 'tags', key: 'tags',
      render: (tags: string[]) => tags?.length ? tags.map((t) => <Tag key={t} color="geekblue">{t}</Tag>) : '—',
    },
    {
      title: '', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => onOpen(r.id)}>Open</Button>
          <Popconfirm
            title="Archive this contact?"
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Archive"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger>Archive</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Contacts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen(null)}>New</Button>
      </div>

      {/* Filter bar */}
      <Space wrap>
        <Input.Search
          placeholder="Search name, email, phone…"
          allowClear
          style={{ width: 280 }}
          onSearch={(v) => setSearch(v)}
          onChange={(e) => !e.target.value && setSearch('')}
        />
        <Select
          allowClear
          placeholder="All types"
          style={{ width: 140 }}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v)}
          options={[
            { value: 'COMPANY', label: 'Companies' },
            { value: 'INDIVIDUAL', label: 'Individuals' },
          ]}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={contacts as any[]}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} contacts` }}
        />
      </Card>
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const ContactsPage: React.FC = () => {
  const [selected, setSelected] = useState<string | null | 'list'>('list');
  const qc = useQueryClient();

  const handleOpen = (id: string | null) => setSelected(id === null ? 'new' : id);
  const handleBack = () => { setSelected('list'); qc.invalidateQueries({ queryKey: ['contacts'] }); };

  if (selected === 'list') return <ContactsList onOpen={handleOpen} />;

  return (
    <ContactDetail
      contactId={selected === 'new' ? null : selected}
      onBack={handleBack}
      onSaved={handleBack}
    />
  );
};

export default ContactsPage;
