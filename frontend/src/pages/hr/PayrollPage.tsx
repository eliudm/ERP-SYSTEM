import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Modal, Form, Select, message, Tag,
  Statistic, Row, Col,
} from 'antd';
import {
  PlusOutlined, CheckOutlined,
  DollarOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../api/hr.api';
import { formatCurrency, getStatusColor } from '../../utils/format';

const { Title, Text } = Typography;

const monthNames = [
  '', 'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December',
];

export const PayrollPage: React.FC = () => {
  const [modal, setModal] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: payrolls, isLoading } = useQuery({
    queryKey: ['payrolls'],
    queryFn: hrApi.getPayrolls,
  });

  const { data: payrollDetail } = useQuery({
    queryKey: ['payroll-detail', detailModal?.id],
    queryFn: () => hrApi.getPayrollDetail(detailModal?.id),
    enabled: !!detailModal?.id,
  });

  const generateMutation = useMutation({
    mutationFn: hrApi.generatePayroll,
    onSuccess: () => {
      message.success('Payroll generated successfully');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: hrApi.approvePayroll,
    onSuccess: () => {
      message.success('Payroll approved — journal entry posted');
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const paidMutation = useMutation({
    mutationFn: hrApi.markPayrollPaid,
    onSuccess: () => {
      message.success('Payroll marked as paid');
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Failed'),
  });

  const columns = [
    {
      title: 'Period',
      key: 'period',
      render: (_: any, r: any) => `${monthNames[r.month]} ${r.year}`,
    },
    { title: 'Employees', dataIndex: ['_count', 'lines'], key: 'count' },
    { title: 'Gross', dataIndex: 'totalGross', key: 'gross', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'PAYE', dataIndex: 'totalPaye', key: 'paye', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'NHIF', dataIndex: 'totalNhif', key: 'nhif', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'NSSF', dataIndex: 'totalNssf', key: 'nssf', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
    { title: 'Net Pay', dataIndex: 'totalNet', key: 'net', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{formatCurrency(Number(v))}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(r)} />
          {r.status === 'DRAFT' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approveMutation.mutate(r.id)} loading={approveMutation.isPending} />
          )}
          {r.status === 'APPROVED' && (
            <Button size="small" style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }} icon={<DollarOutlined />} onClick={() => paidMutation.mutate(r.id)} loading={paidMutation.isPending} />
          )}
        </Space>
      ),
    },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Payroll</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Generate Payroll</Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={payrolls || []} rowKey="id" loading={isLoading} />
      </Card>

      {/* Generate Modal */}
      <Modal title="Generate Payroll" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} confirmLoading={generateMutation.isPending} okText="Generate">
        <Form form={form} layout="vertical" onFinish={generateMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="month" label="Month" rules={[{ required: true }]}>
            <Select options={monthNames.slice(1).map((m, i) => ({ value: i + 1, label: m }))} />
          </Form.Item>
          <Form.Item name="year" label="Year" rules={[{ required: true }]} initialValue={currentYear}>
            <Select options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: y, label: y }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`Payroll — ${monthNames[detailModal?.month]} ${detailModal?.year}`}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={800}
      >
        {payrollDetail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title="Gross" value={Number(payrollDetail.totalGross)} formatter={(v) => formatCurrency(Number(v))} /></Col>
              <Col span={6}><Statistic title="PAYE" value={Number(payrollDetail.totalPaye)} formatter={(v) => formatCurrency(Number(v))} valueStyle={{ color: '#f5222d' }} /></Col>
              <Col span={6}><Statistic title="NHIF + NSSF" value={Number(payrollDetail.totalNhif) + Number(payrollDetail.totalNssf)} formatter={(v) => formatCurrency(Number(v))} valueStyle={{ color: '#fa8c16' }} /></Col>
              <Col span={6}><Statistic title="Net Pay" value={Number(payrollDetail.totalNet)} formatter={(v) => formatCurrency(Number(v))} valueStyle={{ color: '#52c41a' }} /></Col>
            </Row>
            <Table
              dataSource={payrollDetail.lines}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Employee', key: 'name', render: (_: any, r: any) => `${r.employee.firstName} ${r.employee.lastName}` },
                { title: 'Gross', dataIndex: 'grossSalary', key: 'gross', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
                { title: 'PAYE', dataIndex: 'payeAmount', key: 'paye', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
                { title: 'NHIF', dataIndex: 'nhifAmount', key: 'nhif', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
                { title: 'NSSF', dataIndex: 'nssfAmount', key: 'nssf', align: 'right' as const, render: (v: number) => formatCurrency(Number(v)) },
                { title: 'Net', dataIndex: 'netSalary', key: 'net', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{formatCurrency(Number(v))}</Text> },
              ]}
            />
          </Space>
        )}
      </Modal>
    </Space>
  );
};
