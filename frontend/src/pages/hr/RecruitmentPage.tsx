import React, { useState } from 'react';
import {
  Button, Table, Tag, Space, Modal, Form, Input, InputNumber, Select, message,
  Typography, Card,
} from 'antd';
import { PlusOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

const STAGE_COLORS: Record<string, string> = {
  APPLIED: 'blue', SCREENING: 'processing', INTERVIEW: 'warning', OFFER: 'success', HIRED: 'green', REJECTED: 'red',
};

// Backend supports: shortlist → SCREENING, offer → OFFER, hire → HIRED, reject → REJECTED
const STAGE_NEXT_ACTION: Record<string, 'shortlist' | 'offer' | 'hire'> = {
  APPLIED: 'shortlist',
  SCREENING: 'offer',
  INTERVIEW: 'offer',
  OFFER: 'hire',
};

export const RecruitmentPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hireRecord, setHireRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const [hireForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['job-applications'],
    queryFn: () => hrApi.getApplications(),
  });

  const { data: postings = [] } = useQuery({
    queryKey: ['job-postings'],
    queryFn: async () => {
      const res = await import('../../api/client').then(m => m.apiClient.get('/hr/recruitment/postings'));
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => hrApi.createApplication(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); message.success('Application created'); setOpen(false); form.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'shortlist' | 'reject' | 'offer' | 'hire'; hireData?: any }) =>
      hrApi.advanceStage(id, action),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); message.success('Stage updated'); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const hireMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hrApi.advanceStage(id, 'hire', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); message.success('Employee hired'); setHireRecord(null); hireForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Error'),
  });

  const columns: ColumnsType<any> = [
    { title: 'Candidate', key: 'name', render: (_, r) => r.applicantName ?? r.candidateName ?? '—' },
    { title: 'Position', key: 'pos', render: (_, r) => r.jobPosting?.title ?? '—' },
    { title: 'Email', key: 'email', render: (_, r) => r.applicantEmail ?? r.email ?? '—' },
    { title: 'Phone', key: 'phone', render: (_, r) => r.applicantPhone ?? r.phone ?? '—' },
    { title: 'Applied', key: 'date', render: (_, r) => r.appliedDate ? new Date(r.appliedDate).toLocaleDateString() : '—' },
    { title: 'Stage', dataIndex: 'status', key: 'stage', render: (v) => <Tag color={STAGE_COLORS[v] ?? 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => {
        const nextAction = STAGE_NEXT_ACTION[r.status];
        return (
          <Space>
            {nextAction && nextAction !== 'hire' && (
              <Button size="small" icon={<ArrowRightOutlined />}
                onClick={() => advanceMutation.mutate({ id: r.id, action: nextAction })}>
                {nextAction === 'shortlist' ? 'Shortlist' : 'Make Offer'}
              </Button>
            )}
            {nextAction === 'hire' && (
              <Button size="small" type="primary" onClick={() => setHireRecord(r)}>Hire</Button>
            )}
            {r.status !== 'REJECTED' && r.status !== 'HIRED' && (
              <Button size="small" danger onClick={() => advanceMutation.mutate({ id: r.id, action: 'reject' })}>Reject</Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Recruitment</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New Application</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={applications} loading={isLoading} rowKey="id" size="small" />
      </Card>

      <Modal title="New Job Application" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="jobPostingId" label="Job Posting" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(postings as any[]).map((p: any) => ({ value: p.id, label: p.title }))} />
          </Form.Item>
          <Form.Item name="applicantName" label="Candidate Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="applicantEmail" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="applicantPhone" label="Phone"><Input /></Form.Item>
          <Form.Item name="coverLetter" label="Cover Letter"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Hire Applicant" open={!!hireRecord} onCancel={() => { setHireRecord(null); hireForm.resetFields(); }}
        onOk={() => hireForm.submit()} confirmLoading={hireMutation.isPending} destroyOnClose>
        <Form form={hireForm} layout="vertical" style={{ marginTop: 12 }}
          onFinish={(v) => hireMutation.mutate({ id: hireRecord?.id, data: v })}>
          <Form.Item name="department" label="Department" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="jobTitle" label="Job Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="basicSalary" label="Basic Salary" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          <Form.Item name="startDate" label="Start Date"><Input type="date" /></Form.Item>
          <Form.Item name="nationalId" label="National ID"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default RecruitmentPage;
