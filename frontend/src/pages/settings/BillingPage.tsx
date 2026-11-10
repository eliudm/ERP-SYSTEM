import React, { useState, useEffect, useRef } from 'react';
import {
  Row, Col, Button, Tag, Typography, Space, Table, Modal, Select,
  Alert, Divider, message as antMessage, Spin, Popconfirm, Input, Tabs,
} from 'antd';
import {
  CheckCircleOutlined, CrownOutlined, RocketOutlined, StarOutlined,
  ThunderboltOutlined, PhoneOutlined, MailOutlined, ExclamationCircleOutlined,
  MobileOutlined, LoadingOutlined, CreditCardOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  billingApi,
  type SubscriptionPlan,
  type PlanTier,
  type BillingCycle,
  type StkPushResult,
} from '../../api/billing.api';

const { Title, Text, Paragraph } = Typography;

const PLAN_ICONS: Record<PlanTier, React.ReactNode> = {
  FREE: <StarOutlined />,
  STARTER: <RocketOutlined />,
  PROFESSIONAL: <ThunderboltOutlined />,
  ENTERPRISE: <CrownOutlined />,
};

const PLAN_COLORS: Record<PlanTier, string> = {
  FREE: '#8c8c8c',
  STARTER: '#009EE2',
  PROFESSIONAL: '#875A7B',
  ENTERPRISE: '#d4380d',
};

const tierOrder: PlanTier[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Title level={2} style={{ color: '#017e84', fontWeight: 700, margin: '36px 0 16px', fontSize: 28 }}>
    {children}
  </Title>
);

const RowItem: React.FC<{ label: React.ReactNode; action?: React.ReactNode; desc?: string }> = ({ label, action, desc }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
    <div>
      <Text strong style={{ color: '#2f2749', fontSize: 14 }}>{label}</Text>
      {desc && <div><Text type="secondary" style={{ fontSize: 13 }}>{desc}</Text></div>}
    </div>
    {action && <div style={{ marginLeft: 24, flexShrink: 0 }}>{action}</div>}
  </div>
);

const PAYPAL_CLIENT_ID = (import.meta as any).env?.VITE_PAYPAL_CLIENT_ID ?? 'sb';

export const BillingPage: React.FC = () => {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [upgradeResult, setUpgradeResult] = useState<{ instructions: string; amount: number } | null>(null);

  // unified Pay Now modal
  const [payOpen, setPayOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [activePayTab, setActivePayTab] = useState<'mpesa' | 'card' | 'paypal'>('mpesa');

  // M-Pesa state
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStep, setMpesaStep] = useState<'form' | 'waiting' | 'success' | 'failed'>('form');
  const [stkResult, setStkResult] = useState<StkPushResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stripe return handling
  const [stripeStatus, setStripeStatus] = useState<'verifying' | 'success' | 'failed' | 'cancelled' | null>(null);

  // PayPal result state
  const [paypalStatus, setPaypalStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  // Handle Stripe return from checkout
  useEffect(() => {
    const stripeSession = searchParams.get('stripe_session');
    const status = searchParams.get('status');
    if (!stripeSession && !status) return;

    setSearchParams({}, { replace: true });

    if (status === 'cancelled') {
      setStripeStatus('cancelled');
      return;
    }
    if (stripeSession && status === 'success') {
      setStripeStatus('verifying');
      billingApi.verifyStripeSession(stripeSession)
        .then(result => {
          if (result.paid) {
            setStripeStatus('success');
            qc.invalidateQueries({ queryKey: ['billing-subscription'] });
            qc.invalidateQueries({ queryKey: ['billing-payments'] });
          } else {
            setStripeStatus('failed');
          }
        })
        .catch(() => setStripeStatus('failed'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: plans } = useQuery({ queryKey: ['billing-plans'], queryFn: billingApi.listPlans });
  const { data: subscription, isLoading } = useQuery({ queryKey: ['billing-subscription'], queryFn: billingApi.getSubscription });
  const { data: payments } = useQuery({ queryKey: ['billing-payments'], queryFn: billingApi.listPayments });

  const upgradeMut = useMutation({
    mutationFn: () => billingApi.requestUpgrade({ planTier: selectedTier!, billingCycle }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['billing-subscription'] });
      setUpgradeResult({ instructions: data.instructions, amount: Number(data.payment.amount) });
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Request failed'),
  });

  const stkMut = useMutation({
    mutationFn: () => billingApi.initiateStkPush({ planTier: selectedTier!, billingCycle, phone: mpesaPhone }),
    onSuccess: (data) => {
      setStkResult(data);
      setMpesaStep('waiting');
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const st = await billingApi.checkStkStatus(data.checkoutRequestId);
          if (st.paid) {
            stopPolling(); setMpesaStep('success');
            qc.invalidateQueries({ queryKey: ['billing-subscription'] });
            qc.invalidateQueries({ queryKey: ['billing-payments'] });
          } else if (st.resultCode > 0 && st.resultCode !== -1) {
            stopPolling(); setMpesaStep('failed');
          }
        } catch { /* network hiccup */ }
        if (attempts >= 24) { stopPolling(); setMpesaStep('failed'); }
      }, 5000);
    },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed to initiate M-Pesa payment'),
  });

  const stripeMut = useMutation({
    mutationFn: () => billingApi.createStripeSession({ planTier: selectedTier!, billingCycle }),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: any) => antMessage.error(err?.response?.data?.message ?? 'Failed to start card payment'),
  });

  const openPayNow = (tier: PlanTier) => {
    setSelectedTier(tier);
    setMpesaStep('form');
    setStkResult(null);
    setMpesaPhone('');
    setPaypalStatus('idle');
    setActivePayTab('mpesa');
    setPayOpen(true);
  };

  const closePayModal = () => { stopPolling(); setPayOpen(false); };

  const USD_PRICES: Record<string, { monthly: number; annual: number }> = {
    STARTER:      { monthly: 19,  annual: 190  },
    PROFESSIONAL: { monthly: 57,  annual: 570  },
    ENTERPRISE:   { monthly: 190, annual: 1900 },
  };

  const selectedPlan = plans?.find((p: SubscriptionPlan) => p.tier === selectedTier);
  const payAmount = selectedPlan
    ? (billingCycle === 'ANNUAL' ? Number(selectedPlan.annualPrice) : Number(selectedPlan.monthlyPrice))
    : 0;
  const payAmountUsd = selectedTier && USD_PRICES[selectedTier]
    ? (billingCycle === 'ANNUAL' ? USD_PRICES[selectedTier].annual : USD_PRICES[selectedTier].monthly)
    : Math.round(payAmount / 130);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const sub = subscription;
  const plan = sub?.plan;
  const currentTierIndex = plan ? tierOrder.indexOf(plan.tier) : 0;

  const monthlyPrice = Number(plan?.monthlyPrice ?? 0);
  const vatRate = 0.16;
  const vatAmt = monthlyPrice * vatRate;
  const total = monthlyPrice + vatAmt;

  return (
    <div style={{ padding: '32px 48px', maxWidth: 960, background: '#fff', minHeight: '100vh' }}>

      {/* Stripe return alerts */}
      {stripeStatus === 'verifying' && (
        <Alert type="info" showIcon message="Verifying your card payment…" style={{ marginBottom: 16 }} />
      )}
      {stripeStatus === 'success' && (
        <Alert type="success" showIcon closable onClose={() => setStripeStatus(null)}
          message="Card payment successful! Your subscription has been activated." style={{ marginBottom: 16 }} />
      )}
      {stripeStatus === 'failed' && (
        <Alert type="error" showIcon closable onClose={() => setStripeStatus(null)}
          message="Payment verification failed. Contact support if you were charged." style={{ marginBottom: 16 }} />
      )}
      {stripeStatus === 'cancelled' && (
        <Alert type="warning" showIcon closable onClose={() => setStripeStatus(null)}
          message="Card payment was cancelled. You can try again when ready." style={{ marginBottom: 16 }} />
      )}

      {/* ── Subscription ── */}
      <SectionTitle>Subscription</SectionTitle>

      <Row gutter={48}>
        {/* Left: summary */}
        <Col xs={24} md={8}>
          {sub && (
            <div>
              <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                {sub.status === 'TRIAL'
                  ? `Trial expires on ${new Date(sub.trialEndsAt ?? sub.currentPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : `Expires on ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                {sub.billingCycle === 'ANNUAL' ? 'Annual Subscription' : 'Monthly Subscription'}
              </Text>
              <Tag color={sub.status === 'ACTIVE' ? 'success' : sub.status === 'TRIAL' ? 'processing' : 'error'} style={{ marginTop: 4 }}>
                {sub.status}
              </Tag>
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <Text strong style={{ color: '#5a3e78', fontSize: 15, display: 'block', marginBottom: 8 }}>Need Help?</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>Contact our support team for billing queries.</Text>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>
                <PhoneOutlined style={{ marginRight: 6, color: '#017e84' }} />
                <Text style={{ fontSize: 13 }}>+254 700 000 000</Text>
              </div>
              <div>
                <MailOutlined style={{ marginRight: 6, color: '#017e84' }} />
                <Text style={{ fontSize: 13 }}>billing@nexus-erp.co.ke</Text>
              </div>
            </div>
          </div>
        </Col>

        {/* Right: plan + cost breakdown */}
        <Col xs={24} md={16}>
          {plan && (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '0 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text style={{ fontSize: 14 }}>{plan.name} Plan</Text>
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>{plan.maxUsers === -1 ? 'Unlimited' : `${plan.maxUsers} User${plan.maxUsers !== 1 ? 's' : ''}`}</Text>
                  <Text strong>KES {monthlyPrice.toLocaleString()}</Text>
                </Space>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px' }}>
                <Text type="secondary">Subtotal</Text>
                <Text>KES {monthlyPrice.toLocaleString()}</Text>
              </div>
              {monthlyPrice > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text type="secondary">VAT (16%)</Text>
                  <Text>KES {vatAmt.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 14px', borderTop: '1px solid #f0f0f0', marginTop: 6 }}>
                <Text strong>Total</Text>
                <Text strong style={{ fontSize: 15 }}>KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </div>
              <div style={{ padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
                <Space wrap>
                  <Button onClick={() => { setSelectedTier(plan.tier); setPayOpen(true); }}>Update payment method</Button>
                  <Button onClick={() => { setSelectedTier(plan.tier); setBillingCycle('ANNUAL'); setPayOpen(true); }}>
                    Renew yearly
                  </Button>
                </Space>
              </div>
            </div>
          )}
        </Col>
      </Row>

      {/* ── Current Plan ── */}
      <SectionTitle>Current Plan</SectionTitle>
      <Row gutter={16} style={{ marginBottom: 8 }}>
        <Col xs={24} md={6}>
          <Text strong style={{ color: '#5a3e78', display: 'block', marginBottom: 4 }}>Switch Plan</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>Flexible; change at any time.</Text>
        </Col>
        <Col xs={24} md={18}>
          <Row gutter={12}>
            {(plans ?? []).map((p: SubscriptionPlan, i: number) => {
              const isCurrent = plan?.tier === p.tier;
              const isUpgrade = i > currentTierIndex;
              const mp = Number(p.monthlyPrice);
              return (
                <Col xs={24} sm={8} key={p.id}>
                  <div style={{
                    border: isCurrent ? `2px solid ${PLAN_COLORS[p.tier]}` : '1.5px solid #e8e8e8',
                    borderRadius: 10, padding: 16, marginBottom: 12, position: 'relative',
                    background: isCurrent ? `${PLAN_COLORS[p.tier]}08` : '#fff',
                  }}>
                    {isCurrent && (
                      <Tag style={{ position: 'absolute', top: 10, right: 10, background: '#017e84', color: '#fff', border: 'none' }}>
                        Running
                      </Tag>
                    )}
                    <Title level={4} style={{ color: PLAN_COLORS[p.tier], margin: '0 0 4px' }}>{p.name}</Title>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                      {p.maxUsers === -1 ? 'Unlimited users' : `Up to ${p.maxUsers} user${p.maxUsers !== 1 ? 's' : ''}`}
                    </Text>
                    <Divider style={{ margin: '8px 0' }} />
                    {mp === 0 ? (
                      <Text strong style={{ fontSize: 16 }}>Free</Text>
                    ) : (
                      <>
                        <Text strong style={{ fontSize: 20, color: PLAN_COLORS[p.tier] }}>
                          KES {mp.toLocaleString()}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}> /month</Text>
                      </>
                    )}
                    {!isCurrent && mp > 0 && (
                      <Button
                        size="small" block
                        style={{ marginTop: 10 }}
                        type={isUpgrade ? 'primary' : 'default'}
                        icon={<MobileOutlined />}
                        onClick={() => openPayNow(p.tier)}
                      >
                        {isUpgrade ? 'Pay & Upgrade' : 'Pay & Switch'}
                      </Button>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        </Col>
      </Row>

      {/* ── Payment History ── */}
      <SectionTitle>Payment History</SectionTitle>
      <Table
        rowKey="id" size="small"
        dataSource={payments?.data ?? []}
        pagination={{ pageSize: 5, size: 'small' }}
        locale={{ emptyText: 'No payment records yet' }}
        columns={[
          { title: 'Date', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString('en-KE') },
          { title: 'Plan', render: (_: unknown, r: any) => <Text>{r.plan?.name ?? '—'}</Text> },
          { title: 'Amount', dataIndex: 'amount', render: (v: number) => `KES ${Number(v).toLocaleString()}` },
          { title: 'Period', render: (_: unknown, r: any) => `${new Date(r.periodStart).toLocaleDateString('en-KE')} – ${new Date(r.periodEnd).toLocaleDateString('en-KE')}` },
          { title: 'Method', dataIndex: 'method', render: (v: string | null) => v ?? '—' },
          { title: 'Reference', dataIndex: 'reference', render: (v: string | null) => v ?? '—' },
          { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag color={v === 'PAID' ? 'success' : v === 'PENDING' ? 'processing' : 'error'}>{v}</Tag> },
        ]}
      />

      {/* ── Danger zone ── */}
      <SectionTitle>Cancel Subscription</SectionTitle>
      <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <Text strong style={{ color: '#cf1322', display: 'block', marginBottom: 6 }}>
          <ExclamationCircleOutlined style={{ marginRight: 6 }} />Danger Zone
        </Text>
        <Text style={{ fontSize: 13 }}>Proceed with caution as these actions will affect your access.</Text>
      </div>
      <RowItem
        label="Cancel Subscription"
        desc="Your account will revert to the Free plan at the end of the current billing period."
        action={
          <Popconfirm
            title="Cancel subscription?"
            description="You'll keep access until your period ends, then revert to Free."
            onConfirm={() => antMessage.info('Please contact billing@nexus-erp.co.ke to cancel.')}
            okText="Request Cancellation"
            cancelText="Keep Subscription"
          >
            <Button danger>Cancel Subscription</Button>
          </Popconfirm>
        }
      />

      {/* Payment instructions result */}
      <Modal
        open={!!upgradeResult}
        title="Complete Your Payment"
        onCancel={() => setUpgradeResult(null)}
        footer={<Button type="primary" onClick={() => setUpgradeResult(null)}>Close</Button>}
      >
        {upgradeResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="success" message="Upgrade request received!" />
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 16 }}>
              <Paragraph style={{ margin: 0, fontSize: 14 }}>{upgradeResult.instructions}</Paragraph>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Your subscription will be activated within 1 business day after payment confirmation.
            </Text>
          </Space>
        )}
      </Modal>

      {/* ── Pay Now Modal (M-Pesa / Card / PayPal) ── */}
      <Modal
        open={payOpen}
        title={
          <Space>
            <CreditCardOutlined />
            <span>Pay Now — {selectedPlan?.name ?? ''}</span>
          </Space>
        }
        onCancel={closePayModal}
        footer={null}
        width={480}
        maskClosable={mpesaStep !== 'waiting'}
        destroyOnClose
      >
        {/* Billing cycle selector always visible */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13 }}>Billing Cycle</Text>
          <Select style={{ width: '100%', marginTop: 6 }} value={billingCycle} onChange={(v: BillingCycle) => setBillingCycle(v)}>
            <Select.Option value="MONTHLY">Monthly — KES {Number(selectedPlan?.monthlyPrice ?? 0).toLocaleString()}</Select.Option>
            <Select.Option value="ANNUAL">Annual — KES {Number(selectedPlan?.annualPrice ?? 0).toLocaleString()} (save ~17%)</Select.Option>
          </Select>
        </div>

        <Tabs
          activeKey={activePayTab}
          onChange={(k) => setActivePayTab(k as typeof activePayTab)}
          items={[
            {
              key: 'mpesa',
              label: <Space><MobileOutlined style={{ color: '#52c41a' }} />M-Pesa</Space>,
              children: (
                <div style={{ paddingTop: 8 }}>
                  {mpesaStep === 'form' && (
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <Alert type="info" showIcon
                        message={`Send KES ${payAmount.toLocaleString()} for the ${selectedPlan?.name} plan`}
                      />
                      <div>
                        <Text strong>M-Pesa Phone Number</Text>
                        <Input
                          size="large"
                          prefix={<PhoneOutlined />}
                          placeholder="07XXXXXXXX or 2547XXXXXXXX"
                          value={mpesaPhone}
                          onChange={e => setMpesaPhone(e.target.value)}
                          style={{ marginTop: 8 }}
                        />
                      </div>
                      <Alert type="warning" showIcon message="An M-Pesa STK Push will be sent to your phone. Enter your PIN to complete." />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={closePayModal}>Cancel</Button>
                        <Button
                          type="primary"
                          style={{ background: '#52c41a', borderColor: '#52c41a' }}
                          loading={stkMut.isPending}
                          disabled={!mpesaPhone.trim()}
                          onClick={() => stkMut.mutate()}
                          icon={<MobileOutlined />}
                        >
                          Send M-Pesa Prompt
                        </Button>
                      </div>
                    </Space>
                  )}

                  {mpesaStep === 'waiting' && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <LoadingOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 20 }} />
                      <Title level={4}>Waiting for payment…</Title>
                      <Paragraph type="secondary">
                        A prompt was sent to <strong>{mpesaPhone}</strong>.<br />
                        Enter your M-Pesa PIN to complete.
                      </Paragraph>
                      {stkResult && <Alert type="info" showIcon message={stkResult.customerMessage} style={{ marginTop: 8 }} />}
                      <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                        This window updates automatically. Do not close it.
                      </Paragraph>
                    </div>
                  )}

                  {mpesaStep === 'success' && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <CheckCircleOutlined style={{ fontSize: 56, color: '#52c41a', marginBottom: 16 }} />
                      <Title level={4} style={{ color: '#52c41a' }}>Payment Successful!</Title>
                      <Paragraph>Your subscription has been activated. Thank you!</Paragraph>
                      <Button type="primary" onClick={closePayModal} style={{ marginTop: 8 }}>Close</Button>
                    </div>
                  )}

                  {mpesaStep === 'failed' && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <ExclamationCircleOutlined style={{ fontSize: 56, color: '#ff4d4f', marginBottom: 16 }} />
                      <Title level={4} style={{ color: '#ff4d4f' }}>Payment Failed or Timed Out</Title>
                      <Paragraph type="secondary">The M-Pesa payment was not completed. You can try again.</Paragraph>
                      <Space style={{ marginTop: 16 }}>
                        <Button onClick={() => setMpesaStep('form')}>Try Again</Button>
                        <Button onClick={closePayModal}>Close</Button>
                      </Space>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'card',
              label: <Space><CreditCardOutlined />Card</Space>,
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    <Alert type="info" showIcon
                      message={`Pay KES ${payAmount.toLocaleString()} securely via Stripe`}
                      description="You will be redirected to Stripe's secure checkout page."
                    />
                    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
                      <Space wrap>
                        <Text type="secondary" style={{ fontSize: 12 }}>Accepted:</Text>
                        {['Visa', 'Mastercard', 'American Express'].map(c => (
                          <Tag key={c} style={{ fontSize: 11 }}>{c}</Tag>
                        ))}
                      </Space>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button onClick={closePayModal}>Cancel</Button>
                      <Button
                        type="primary"
                        loading={stripeMut.isPending}
                        onClick={() => stripeMut.mutate()}
                        icon={<CreditCardOutlined />}
                      >
                        Pay with Card
                      </Button>
                    </div>
                  </Space>
                </div>
              ),
            },
            {
              key: 'paypal',
              label: <Space><span style={{ fontWeight: 700, color: '#003087' }}>Pay</span><span style={{ fontWeight: 700, color: '#009cde' }}>Pal</span></Space>,
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Alert type="info" showIcon style={{ marginBottom: 16 }}
                    message={`Pay $${payAmountUsd} USD via PayPal`}
                    description={`Equivalent to KES ${payAmount.toLocaleString()}. PayPal processes in USD.`}
                  />
                  {paypalStatus === 'success' && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
                      <Title level={4} style={{ color: '#52c41a' }}>PayPal Payment Successful!</Title>
                      <Paragraph>Your subscription has been activated.</Paragraph>
                      <Button type="primary" onClick={closePayModal} style={{ marginTop: 8 }}>Close</Button>
                    </div>
                  )}
                  {paypalStatus === 'failed' && (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Alert type="error" showIcon message="PayPal payment failed. Please try again." style={{ marginBottom: 12 }} />
                      <Button onClick={() => setPaypalStatus('idle')}>Try Again</Button>
                    </div>
                  )}
                  {paypalStatus === 'idle' && selectedTier && (
                    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD' }}>
                      <PayPalButtons
                        style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
                        createOrder={async () => {
                          const result = await billingApi.createPaypalOrder({ planTier: selectedTier, billingCycle });
                          return result.orderId;
                        }}
                        onApprove={async (data) => {
                          try {
                            const result = await billingApi.capturePaypalOrder(data.orderID);
                            if (result.success) {
                              setPaypalStatus('success');
                              qc.invalidateQueries({ queryKey: ['billing-subscription'] });
                              qc.invalidateQueries({ queryKey: ['billing-payments'] });
                            } else {
                              setPaypalStatus('failed');
                            }
                          } catch {
                            setPaypalStatus('failed');
                          }
                        }}
                        onError={() => setPaypalStatus('failed')}
                        onCancel={() => antMessage.info('PayPal payment cancelled')}
                      />
                    </PayPalScriptProvider>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default BillingPage;
