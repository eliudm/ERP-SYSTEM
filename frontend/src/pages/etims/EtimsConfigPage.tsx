import React, { useState } from 'react';
import {
  Alert, Badge, Button, Card, Col, Descriptions, Divider,
  Row, Space, Steps, Table, Tag, Timeline, Tooltip, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, SendOutlined, SettingOutlined, SafetyCertificateOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { formatDate } from '../../utils/format';

const { Title, Text, Paragraph } = Typography;

// ─── API helpers ─────────────────────────────────────────────────────────────
const etimsApi = {
  getConfig: () => apiClient.get('/etims/config').then(r => r.data),
  getStats: () => apiClient.get('/etims/stats').then(r => r.data),
  getFailedSubmissions: () => apiClient.get('/etims/failed').then(r => r.data),
  getQueueStatus: () => apiClient.get('/etims/queue/status').then(r => r.data),
  initialize: () => apiClient.post('/etims/initialize').then(r => r.data),
  retryAll: () => apiClient.post('/etims/queue/retry-all').then(r => r.data),
  retryInvoice: (invoiceId: string) => apiClient.post(`/etims/invoice/${invoiceId}/retry`).then(r => r.data),
  submitInvoice: (invoiceId: string) => apiClient.post(`/etims/invoice/${invoiceId}/submit`).then(r => r.data),
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    SUCCESS: { color: 'success', icon: <CheckCircleOutlined /> },
    FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
    PENDING: { color: 'processing', icon: <ClockCircleOutlined /> },
    SUBMITTED: { color: 'processing', icon: <ClockCircleOutlined /> },
  };
  const cfg = map[status] || { color: 'default', icon: null };
  return <Badge status={cfg.color as any} text={status} />;
};

// ─── KPI stat card ────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: React.ReactNode; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <Card variant="borderless" style={{ borderRadius: 14, borderTop: `4px solid ${color}`, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    <Space size={4} style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
      {icon}<span>{label}</span>
    </Space>
  </Card>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export const EtimsConfigPage: React.FC = () => {
  const qc = useQueryClient();
  const [initResult, setInitResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const { data: config } = useQuery({ queryKey: ['etims-config'], queryFn: etimsApi.getConfig });
  const { data: stats } = useQuery({ queryKey: ['etims-stats'], queryFn: etimsApi.getStats, refetchInterval: 30000 });
  const { data: failed = [] } = useQuery({ queryKey: ['etims-failed'], queryFn: etimsApi.getFailedSubmissions });
  const { data: queue } = useQuery({ queryKey: ['etims-queue'], queryFn: etimsApi.getQueueStatus, refetchInterval: 15000 });

  const initMut = useMutation({
    mutationFn: etimsApi.initialize,
    onSuccess: (data) => {
      setInitResult(data);
      if (data.success) message.success('Device initialized successfully');
      else message.error(`Initialization failed: ${data.message}`);
    },
    onError: () => message.error('Could not reach eTIMS service'),
  });

  const retryAllMut = useMutation({
    mutationFn: etimsApi.retryAll,
    onSuccess: (data) => {
      message.success(data.message || 'Retry queued');
      qc.invalidateQueries({ queryKey: ['etims-failed'] });
      qc.invalidateQueries({ queryKey: ['etims-stats'] });
    },
  });

  const retryMut = useMutation({
    mutationFn: (invoiceId: string) => etimsApi.retryInvoice(invoiceId),
    onSuccess: () => {
      message.success('Retry submitted');
      qc.invalidateQueries({ queryKey: ['etims-failed'] });
      qc.invalidateQueries({ queryKey: ['etims-stats'] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message || 'Retry failed'),
  });

  const failedColumns = [
    {
      title: 'Invoice', key: 'inv',
      render: (_: any, r: any) => <Text strong>{r.invoice?.invoiceNo}</Text>,
    },
    {
      title: 'Customer', key: 'cust',
      render: (_: any, r: any) => r.invoice?.customer?.name || <Text type="secondary">—</Text>,
    },
    {
      title: 'Attempts', dataIndex: 'retryCount', key: 'rc', align: 'right' as const,
      render: (v: number) => <Tag color={v >= 5 ? 'red' : 'orange'}>{v}</Tag>,
    },
    {
      title: 'Last Error', key: 'err',
      render: (_: any, r: any) => {
        const err = r.submissionLogs?.[0]?.errorMessage;
        if (!err) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={err}>
            <Text type="danger" style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {err}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Updated', dataIndex: 'updatedAt', key: 'dt',
      render: (v: string) => formatDate(v),
    },
    {
      title: '', key: 'action', align: 'right' as const,
      render: (_: any, r: any) => (
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={retryMut.isPending}
          disabled={r.retryCount >= 10}
          onClick={() => retryMut.mutate(r.invoiceId)}
        >
          Retry
        </Button>
      ),
    },
  ];

  const isConfigured = config?.configured;
  const env = config?.environment || 'sandbox';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ color: '#009688', marginRight: 8 }} />
            eTIMS — KRA Electronic Tax Invoice
          </Title>
          <Text type="secondary">Kenya Revenue Authority · Online Sales Control Unit (OSCU)</Text>
        </div>
        <Space>
          <Tag color={env === 'sandbox' ? 'blue' : 'green'} style={{ fontSize: 13, padding: '4px 12px' }}>
            {env.toUpperCase()}
          </Tag>
          <Tag color={isConfigured ? 'success' : 'error'} icon={isConfigured ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}>
            {isConfigured ? 'Configured' : 'Not Configured'}
          </Tag>
        </Space>
      </div>

      {/* Not configured warning */}
      {!isConfigured && (
        <Alert
          type="warning"
          showIcon
          message="eTIMS credentials not configured"
          description={
            <span>
              Set <Text code>ETIMS_SELLER_PIN</Text> and <Text code>ETIMS_DEVICE_SERIAL</Text> in your <Text code>.env</Text> file, then restart the backend.
              See the setup guide below.
            </span>
          }
        />
      )}

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <StatCard label="Total Submitted" value={stats?.total ?? 0} color="#1677ff" icon={<SendOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard label="Successful" value={stats?.success ?? 0} color="#52c41a" icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard label="Failed" value={stats?.failed ?? 0} color="#ff4d4f" icon={<CloseCircleOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard label="Pending" value={stats?.pending ?? 0} color="#fa8c16" icon={<ClockCircleOutlined />} />
        </Col>
      </Row>

      {/* Config + Queue */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={<Text strong><SettingOutlined style={{ marginRight: 6 }} />Configuration</Text>}
            extra={
              <Button
                type="primary"
                icon={<LinkOutlined />}
                loading={initMut.isPending}
                onClick={() => initMut.mutate(undefined as any)}
                disabled={!isConfigured}
              >
                Test Connection
              </Button>
            }
            style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', height: '100%' }}
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Environment">
                <Tag color={env === 'sandbox' ? 'blue' : 'green'}>{env.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Base URL">
                <Text code style={{ fontSize: 11 }}>{config?.baseUrl || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Seller PIN (KRA)">
                <Text code>{config?.sellerPin || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Device Serial">
                <Text code>{config?.deviceSerial || '—'}</Text>
              </Descriptions.Item>
            </Descriptions>

            {initResult && (
              <Alert
                type={initResult.success ? 'success' : 'error'}
                showIcon
                message={initResult.success ? 'Connection successful' : 'Connection failed'}
                description={initResult.message}
                style={{ marginTop: 12 }}
                closable
                onClose={() => setInitResult(null)}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={<Text strong><ReloadOutlined style={{ marginRight: 6 }} />Queue Status</Text>}
            style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', height: '100%' }}
          >
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Waiting">
                <Tag>{queue?.waiting ?? 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Active">
                <Tag color="processing">{queue?.active ?? 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Completed">
                <Tag color="success">{queue?.completed ?? 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Failed">
                <Tag color="error">{queue?.failed ?? 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Delayed">
                <Tag color="warning">{queue?.delayed ?? 0}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Submissions are queued automatically on invoice approval and retried up to 5× with exponential backoff.
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Success rate */}
      {stats && stats.total > 0 && (
        <Alert
          type="info"
          showIcon
          message={`Submission success rate: ${stats.successRate} (${stats.success} of ${stats.total} invoices)`}
        />
      )}

      {/* Failed submissions */}
      <Card
        variant="borderless"
        title={
          <Space>
            <Text strong><CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />Failed Submissions</Text>
            {failed.length > 0 && <Tag color="error">{failed.length}</Tag>}
          </Space>
        }
        extra={
          failed.length > 0 && (
            <Button
              icon={<ReloadOutlined />}
              loading={retryAllMut.isPending}
              onClick={() => retryAllMut.mutate(undefined as any)}
            >
              Retry All
            </Button>
          )
        }
        style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
      >
        {failed.length === 0
          ? <Alert type="success" showIcon message="No failed submissions" />
          : <Table columns={failedColumns} dataSource={failed} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
        }
      </Card>

      <Divider />

      {/* Setup guide */}
      <Card
        variant="borderless"
        title={<Text strong><InfoCircleOutlined style={{ marginRight: 6 }} />Setup Guide</Text>}
        style={{ borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
      >
        <Steps
          direction="vertical"
          size="small"
          current={isConfigured ? 3 : 0}
          items={[
            {
              title: 'Register on KRA iTax',
              description: (
                <Paragraph style={{ marginBottom: 0 }}>
                  Log into <Text strong>iTax</Text> (itax.kra.go.ke) and apply for eTIMS under{' '}
                  <Text italic>e-Filing → eTIMS</Text>. You'll receive an OSCU activation email.
                </Paragraph>
              ),
            },
            {
              title: 'Get Sandbox Credentials',
              description: (
                <Paragraph style={{ marginBottom: 0 }}>
                  Visit the sandbox portal to register a virtual OSCU device. You'll receive a{' '}
                  <Text code>TPIN</Text> (your KRA PIN) and a <Text code>Device Serial</Text> (cmcKey).
                  <br />
                  Sandbox portal: <Text code>https://etims-sbx.kra.go.ke/</Text>
                </Paragraph>
              ),
            },
            {
              title: 'Configure .env',
              description: (
                <div style={{ fontFamily: 'monospace', background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, padding: '12px 16px', marginTop: 6, fontSize: 13 }}>
                  <div style={{ color: '#6a9955' }}># eTIMS (KRA)</div>
                  <div><span style={{ color: '#9cdcfe' }}>ETIMS_ENV</span>=<span style={{ color: '#ce9178' }}>sandbox</span></div>
                  <div><span style={{ color: '#9cdcfe' }}>ETIMS_SELLER_PIN</span>=<span style={{ color: '#ce9178' }}>A000000000X</span>  <span style={{ color: '#6a9955' }}># your KRA PIN</span></div>
                  <div><span style={{ color: '#9cdcfe' }}>ETIMS_DEVICE_SERIAL</span>=<span style={{ color: '#ce9178' }}>SN20240001</span>  <span style={{ color: '#6a9955' }}># OSCU device serial</span></div>
                  <div><span style={{ color: '#9cdcfe' }}>ETIMS_SANDBOX_URL</span>=<span style={{ color: '#ce9178' }}>https://etims-sbx-api.kra.go.ke/etims-api</span></div>
                </div>
              ),
            },
            {
              title: 'Initialize Device & Test',
              description: (
                <Paragraph style={{ marginBottom: 0 }}>
                  After restarting the backend, click <Text strong>Test Connection</Text> above.
                  A result code <Text code>000</Text> means the device is registered and ready.
                  Invoices approved from that point will be automatically queued for eTIMS submission.
                </Paragraph>
              ),
            },
            {
              title: 'Go Live',
              description: (
                <Paragraph style={{ marginBottom: 0 }}>
                  Once sandbox testing passes, change <Text code>ETIMS_ENV=production</Text> and update
                  the credentials to your production PIN and device serial. Restart the server.
                  All invoice approvals will then generate compliant KRA fiscal receipts with QR codes.
                </Paragraph>
              ),
            },
          ]}
        />

        <Divider />

        {/* Key notes */}
        <Title level={5}>Key Notes</Title>
        <Timeline
          items={[
            {
              color: 'blue',
              children: <Text>Invoices are auto-submitted to eTIMS when <Tag color="green">APPROVED</Tag> or <Tag color="blue">PAID</Tag>. No manual action needed.</Text>,
            },
            {
              color: 'orange',
              children: <Text>Tax code <Text code>B</Text> (16% VAT) is applied to all items by default. For zero-rated or exempt items, update the product's <Text code>itemClsCd</Text> and <Text code>taxTyCd</Text>.</Text>,
            },
            {
              color: 'green',
              children: <Text>Successful submissions generate a KRA fiscal QR code, printed on invoices and receipts. Failed submissions show a provisional QR code with submission status.</Text>,
            },
            {
              color: 'red',
              children: <Text>Queue retries 5 times with exponential backoff (5s → 10s → 20s → 40s → 80s). After 10 total retries the record is marked permanently failed — use <Text strong>Retry All</Text> above to requeue.</Text>,
            },
            {
              color: 'purple',
              children: <Text>Customer KRA PINs (B2B) are submitted as <Text code>custTpin</Text>. Set them on the customer record for compliant B2B receipts.</Text>,
            },
          ]}
        />
      </Card>
    </Space>
  );
};

export default EtimsConfigPage;
