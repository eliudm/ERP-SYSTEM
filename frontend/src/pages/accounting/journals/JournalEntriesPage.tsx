import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography,
  Modal, Form, Input, DatePicker, InputNumber,
  Select, message, Descriptions, Divider,
} from 'antd';
import { PlusOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accounting.api';
import { formatCurrency, formatDate, getStatusColor } from '../../../utils/format';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const JournalEntriesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [viewModal, setViewModal] = useState<any>(null);
  const [voidModal, setVoidModal] = useState<{ open: boolean; id: string }>({
    open: false, id: '',
  });
  const [lines, setLines] = useState([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', page],
    queryFn: () => accountingApi.getJournalEntries(page, 20),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.getAccounts,
  });

  const createMutation = useMutation({
    mutationFn: accountingApi.createJournalEntry,
    onSuccess: () => {
      message.success('Journal entry posted successfully');
      setCreateModal(false);
      form.resetFields();
      setLines([
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ]);
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to post journal entry');
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      accountingApi.voidJournalEntry(id, reason),
    onSuccess: () => {
      message.success('Journal entry voided');
      setVoidModal({ open: false, id: '' });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to void');
    },
  });

  const addLine = () =>
    setLines([...lines, { accountId: '', debit: 0, credit: 0, description: '' }]);

  const removeLine = (index: number) =>
    setLines(lines.filter((_, i) => i !== index));

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      createMutation.mutate({
        ...values,
        entryDate: values.entryDate.format('YYYY-MM-DD'),
        lines,
      });
    });
  };

  const columns = [
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || '—',
    },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'date',
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Lines',
      dataIndex: 'lines',
      key: 'lines',
      render: (v: any[]) => v?.length || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewModal(record)}
          />
          {record.status === 'POSTED' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => setVoidModal({ open: true, id: record.id })}
            />
          )}
        </Space>
      ),
    },
  ];

  const accountOptions = accounts?.map((a: any) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  })) || [];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Journal Entries</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModal(true)}
        >
          New Journal Entry
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: data?.meta?.total || 0,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} entries`,
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="New Journal Entry"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending}
        width={800}
        okText="Post Journal Entry"
        okButtonProps={{ disabled: !isBalanced }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="reference"
              label="Reference"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g. JE-001" />
            </Form.Item>
            <Form.Item
              name="entryDate"
              label="Date"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <DatePicker
                style={{ width: '100%' }}
                defaultValue={dayjs()}
              />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Description">
            <Input placeholder="Journal entry description" />
          </Form.Item>
        </Form>

        {/* Journal Lines */}
        <Divider>Journal Lines</Divider>
        <div style={{ background: '#fafafa', borderRadius: 8, padding: 16 }}>
          {lines.map((line, index) => (
            <Space
              key={index}
              style={{ width: '100%', marginBottom: 8 }}
              align="start"
            >
              <Select
                style={{ width: 240 }}
                placeholder="Select account"
                options={accountOptions}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                value={line.accountId || undefined}
                onChange={(v) => updateLine(index, 'accountId', v)}
              />
              <InputNumber
                placeholder="Debit"
                min={0}
                style={{ width: 120 }}
                value={line.debit || undefined}
                onChange={(v) => updateLine(index, 'debit', v || 0)}
              />
              <InputNumber
                placeholder="Credit"
                min={0}
                style={{ width: 120 }}
                value={line.credit || undefined}
                onChange={(v) => updateLine(index, 'credit', v || 0)}
              />
              <Input
                placeholder="Description"
                style={{ width: 160 }}
                value={line.description}
                onChange={(e) => updateLine(index, 'description', e.target.value)}
              />
              {lines.length > 2 && (
                <Button danger size="small" onClick={() => removeLine(index)}>
                  ✕
                </Button>
              )}
            </Space>
          ))}

          <Button type="dashed" onClick={addLine} block style={{ marginTop: 8 }}>
            + Add Line
          </Button>

          {/* Totals */}
          <Divider style={{ margin: '12px 0' }} />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }} size="large">
            <Text>Debit: <Text strong style={{ color: '#1677ff' }}>{formatCurrency(totalDebit)}</Text></Text>
            <Text>Credit: <Text strong style={{ color: '#52c41a' }}>{formatCurrency(totalCredit)}</Text></Text>
            {!isBalanced && (
              <Text type="danger">⚠️ Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</Text>
            )}
            {isBalanced && totalDebit > 0 && (
              <Text type="success">✅ Balanced</Text>
            )}
          </Space>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        title={`Journal Entry — ${viewModal?.reference}`}
        open={!!viewModal}
        onCancel={() => setViewModal(null)}
        footer={null}
        width={700}
      >
        {viewModal && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions bordered size="small">
              <Descriptions.Item label="Reference">{viewModal.reference}</Descriptions.Item>
              <Descriptions.Item label="Date">{formatDate(viewModal.entryDate)}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(viewModal.status)}>{viewModal.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={3}>
                {viewModal.description || '—'}
              </Descriptions.Item>
            </Descriptions>

            <Table
              dataSource={viewModal.lines}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Account', dataIndex: ['account', 'name'], key: 'account' },
                {
                  title: 'Debit',
                  dataIndex: 'debit',
                  key: 'debit',
                  align: 'right' as const,
                  render: (v: number) => Number(v) > 0 ? formatCurrency(Number(v)) : '—',
                },
                {
                  title: 'Credit',
                  dataIndex: 'credit',
                  key: 'credit',
                  align: 'right' as const,
                  render: (v: number) => Number(v) > 0 ? formatCurrency(Number(v)) : '—',
                },
                { title: 'Description', dataIndex: 'description', key: 'desc', render: (v: string) => v || '—' },
              ]}
            />
          </Space>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal
        title="Void Journal Entry"
        open={voidModal.open}
        onCancel={() => setVoidModal({ open: false, id: '' })}
        onOk={() => voidMutation.mutate({ id: voidModal.id, reason: 'Voided by user' })}
        okButtonProps={{ danger: true, loading: voidMutation.isPending }}
        okText="Void Entry"
      >
        <p>This will create a reversing journal entry. Are you sure?</p>
      </Modal>
    </Space>
  );
};
