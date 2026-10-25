import React, { useState } from 'react';
import {
  Card, Typography, Space, Table, DatePicker, Button, Statistic,
  Row, Col, Tabs, InputNumber, Tag, Empty,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { taxApi, type TaxSummaryMonth } from '../../api/tax.api';
import { formatCurrency } from '../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Fixed categorical order — never cycled/reassigned when data changes.
const SERIES_COLORS = {
  outputVat: '#1677ff',
  inputVat: '#faad14',
  vatPayable: '#52c41a',
};

// ─── VAT Return tab ──────────────────────────────────────────────────────────
const VatReturnTab: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().endOf('month').format('YYYY-MM-DD'),
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vat-return', dates],
    queryFn: () => taxApi.getVatReturn(dates[0], dates[1]),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary">VAT return for the selected period (output tax less input tax).</Text>
        <Space>
          <RangePicker
            defaultValue={[dayjs(dates[0]), dayjs(dates[1])]}
            onChange={(_, strings) => {
              if (strings[0] && strings[1]) setDates([strings[0], strings[1]]);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
            Generate
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Output Tax (Sales)">
            <Statistic title="Taxable Sales" value={data?.outputTax.taxableSales ?? 0} formatter={(v) => formatCurrency(Number(v))} />
            <Statistic
              title="VAT Collected"
              value={data?.outputTax.vatCollected ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: SERIES_COLORS.outputVat }}
              style={{ marginTop: 16 }}
            />
            <Text type="secondary">{data?.outputTax.numberOfSupplies ?? 0} invoice(s)</Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Input Tax (Purchases)">
            <Statistic title="Taxable Purchases" value={data?.inputTax.taxablePurchases ?? 0} formatter={(v) => formatCurrency(Number(v))} />
            <Statistic
              title="VAT Paid"
              value={data?.inputTax.vatPaid ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: SERIES_COLORS.inputVat }}
              style={{ marginTop: 16 }}
            />
            <Text type="secondary">{data?.inputTax.numberOfPurchases ?? 0} bill(s)</Text>
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Statistic
              title="Net VAT (Output − Input)"
              value={data?.netVat ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.netVat ?? 0) >= 0 ? '#f5222d' : '#52c41a' }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="VAT Payable"
              value={data?.vatPayable ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#f5222d' }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="VAT Refundable"
              value={data?.vatRefundable ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

// ─── WHT Report tab ──────────────────────────────────────────────────────────
const WhtReportTab: React.FC = () => {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().endOf('month').format('YYYY-MM-DD'),
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['wht-report', dates],
    queryFn: () => taxApi.getWhtReport(dates[0], dates[1]),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary">Withholding tax deducted via payroll (PAYE, NHIF, NSSF) for the selected period.</Text>
        <Space>
          <RangePicker
            defaultValue={[dayjs(dates[0]), dayjs(dates[1])]}
            onChange={(_, strings) => {
              if (strings[0] && strings[1]) setDates([strings[0], strings[1]]);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
            Generate
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Payrolls" value={data?.paye.payrolls ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Gross Pay" value={data?.paye.totalGross ?? 0} formatter={(v) => formatCurrency(Number(v))} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total PAYE" value={data?.paye.totalPaye ?? 0} formatter={(v) => formatCurrency(Number(v))} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Withholding"
              value={data?.totalWithholding ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Statutory Deductions">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Statistic title="NHIF" value={data?.statutory.nhif ?? 0} formatter={(v) => formatCurrency(Number(v))} />
          </Col>
          <Col xs={24} md={12}>
            <Statistic title="NSSF" value={data?.statutory.nssf ?? 0} formatter={(v) => formatCurrency(Number(v))} />
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

// ─── Annual Summary tab ──────────────────────────────────────────────────────
const AnnualSummaryTab: React.FC = () => {
  const [year, setYear] = useState<number>(dayjs().year());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tax-summary', year],
    queryFn: () => taxApi.getTaxSummary(year),
  });

  const columns = [
    { title: 'Month', dataIndex: 'name', key: 'name' },
    {
      title: 'Output VAT', dataIndex: 'outputVat', key: 'outputVat', align: 'right' as const,
      render: (v: number) => <Text style={{ color: SERIES_COLORS.outputVat }}>{formatCurrency(v)}</Text>,
    },
    {
      title: 'Input VAT', dataIndex: 'inputVat', key: 'inputVat', align: 'right' as const,
      render: (v: number) => <Text style={{ color: SERIES_COLORS.inputVat }}>{formatCurrency(v)}</Text>,
    },
    {
      title: 'VAT Payable', dataIndex: 'vatPayable', key: 'vatPayable', align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v >= 0 ? SERIES_COLORS.vatPayable : '#f5222d' }}>
          {formatCurrency(v)}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary">Month-by-month VAT breakdown for the fiscal/calendar year.</Text>
        <Space>
          <InputNumber min={2000} max={2100} value={year} onChange={(v) => setYear(v ?? dayjs().year())} />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
            Generate
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Annual Output VAT"
              value={data?.annualTotals.outputVat ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: SERIES_COLORS.outputVat }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Annual Input VAT"
              value={data?.annualTotals.inputVat ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: SERIES_COLORS.inputVat }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Annual VAT Payable"
              value={data?.annualTotals.vatPayable ?? 0}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: (data?.annualTotals.vatPayable ?? 0) >= 0 ? SERIES_COLORS.vatPayable : '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title={`Monthly Breakdown — ${year}`}>
        {data?.months.length ? (
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart data={data.months as TaxSummaryMonth[]} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 12, fill: '#888' }} axisLine={{ stroke: '#e0e0e0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} width={110} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="outputVat" name="Output VAT" fill={SERIES_COLORS.outputVat} radius={[4, 4, 0, 0]} />
                <Bar dataKey="inputVat" name="Input VAT" fill={SERIES_COLORS.inputVat} radius={[4, 4, 0, 0]} />
                <Bar dataKey="vatPayable" name="VAT Payable" fill={SERIES_COLORS.vatPayable} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty description="No data for this year" />
        )}
      </Card>

      <Card title="Monthly Detail">
        <Table
          columns={columns}
          dataSource={data?.months ?? []}
          rowKey="month"
          size="small"
          loading={isLoading}
          pagination={false}
        />
      </Card>
    </Space>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const TaxReportsPage: React.FC = () => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Tax Reports</Title>
        <Tag color="blue">KES</Tag>
      </div>

      <Tabs
        items={[
          { key: 'vat', label: 'VAT Return', children: <VatReturnTab /> },
          { key: 'wht', label: 'Withholding Tax', children: <WhtReportTab /> },
          { key: 'summary', label: 'Annual Summary', children: <AnnualSummaryTab /> },
        ]}
      />
    </Space>
  );
};

export default TaxReportsPage;
