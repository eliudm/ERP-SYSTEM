import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Select, Tag, Modal, Form, InputNumber,
  message, Row, Col, Statistic, Tooltip, Upload, Alert,
} from 'antd';
import {
  PlusOutlined, ArrowUpOutlined, ArrowDownOutlined,
  SwapOutlined, UploadOutlined, FileExcelOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  downloadStockImportTemplate,
  parseStockImportFile,
  type ParsedStockImportRow,
} from '../../utils/excel';

const { Title, Text } = Typography;

const MOVEMENT_COLORS: Record<string, string> = {
  IN: 'green',
  OUT: 'red',
  ADJUSTMENT: 'orange',
};

export const StockMovementsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [productFilter, setProductFilter] = useState<string>();
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ParsedStockImportRow[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    failed: number;
    errors: { row: number; code: string; reason: string }[];
  } | null>(null);
  const [parsing, setParsing] = useState(false);

  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', page, productFilter],
    queryFn: () => inventoryApi.getStockMovements(page, 20),
  });

  const { data: summary } = useQuery({
    queryKey: ['stock-movements-summary'],
    queryFn: inventoryApi.getMovementSummary,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => inventoryApi.getProducts(),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  const recordMutation = useMutation({
    mutationFn: inventoryApi.recordMovement,
    onSuccess: () => {
      message.success('Stock movement recorded');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to record movement');
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: inventoryApi.bulkImportStock,
    onSuccess: (result) => {
      setImportResult(result);
      if (result.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
        queryClient.invalidateQueries({ queryKey: ['stock-movements-summary'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
      if (result.failed === 0) {
        message.success(`Imported ${result.imported} row(s)`);
      } else {
        message.warning(`Imported ${result.imported} row(s), ${result.failed} failed — see details below`);
      }
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Import failed');
    },
  });

  const resetImportModal = () => {
    setImportModal(false);
    setImportRows([]);
    setImportResult(null);
  };

  const handleFileSelected = async (file: File) => {
    setParsing(true);
    setImportResult(null);
    try {
      const rows = await parseStockImportFile(file);
      if (rows.length === 0) {
        message.error('No rows found — check the file matches the template columns');
      }
      setImportRows(rows);
    } catch {
      message.error('Could not read that file — make sure it is a valid .xlsx file');
      setImportRows([]);
    } finally {
      setParsing(false);
    }
    return false; // prevent antd Upload from trying to POST the raw file itself
  };

  const knownProductCodes = new Set((products || []).map((p: any) => p.code));
  const knownWarehouseNames = new Set((warehouses || []).map((w: any) => String(w.name).toLowerCase()));

  const importPreviewColumns = [
    {
      title: 'Code',
      dataIndex: 'productCode',
      key: 'productCode',
      render: (v: string) => (
        <Text type={knownProductCodes.has(v) ? undefined : 'danger'}>{v}</Text>
      ),
    },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
    {
      title: 'Warehouse',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      render: (v: string | undefined) => {
        if (!v) return <Text type="secondary">(default)</Text>;
        const ok = knownWarehouseNames.has(v.toLowerCase());
        return <Text type={ok ? undefined : 'danger'}>{v}</Text>;
      },
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitCost',
      key: 'unitCost',
      render: (v: number | undefined) => (v !== undefined ? formatCurrency(v) : '—'),
    },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '—' },
  ];

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      render: (v: string) => formatDate(v),
      width: 120,
    },
    {
      title: 'Type',
      dataIndex: 'movementType',
      key: 'type',
      width: 120,
      render: (v: string) => (
        <Tag color={MOVEMENT_COLORS[v] || 'default'}>
          {v === 'IN' ? <ArrowUpOutlined /> : v === 'OUT' ? <ArrowDownOutlined /> : <SwapOutlined />}
          {' '}{v}
        </Tag>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.product?.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.product?.code}</Text>
        </Space>
      ),
    },
    {
      title: 'Warehouse',
      key: 'warehouse',
      render: (_: any, r: any) => r.warehouse?.name || '—',
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'qty',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <Text style={{ color: r.movementType === 'IN' ? '#52c41a' : r.movementType === 'OUT' ? '#f5222d' : '#fa8c16', fontWeight: 600 }}>
          {r.movementType === 'IN' ? '+' : r.movementType === 'OUT' ? '-' : '~'}{Number(v)}
        </Text>
      ),
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right' as const,
      render: (v: number) => v ? formatCurrency(Number(v)) : '—',
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'ref',
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string) => v
        ? <Tooltip title={v}><Text type="secondary" style={{ fontSize: 12 }}>{v.length > 40 ? `${v.slice(0, 40)}…` : v}</Text></Tooltip>
        : '—',
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Stock Movements</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={() => setImportModal(true)}>
            Import Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>
            Record Movement
          </Button>
        </Space>
      </div>

      {summary && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total IN (This Month)"
                value={summary.totalIn || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<ArrowUpOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total OUT (This Month)"
                value={summary.totalOut || 0}
                valueStyle={{ color: '#f5222d' }}
                prefix={<ArrowDownOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Adjustments"
                value={summary.totalAdjustments || 0}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<SwapOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Net Movement"
                value={(summary.totalIn || 0) - (summary.totalOut || 0)}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder="Filter by product..."
            style={{ width: 280 }}
            allowClear
            showSearch
            onChange={(v) => { setProductFilter(v); setPage(1); }}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={(products || []).map((p: any) => ({
              value: p.id,
              label: `${p.code} — ${p.name}`,
            }))}
          />
        </div>

        <Table
          columns={columns}
          dataSource={movements?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: movements?.meta?.total || 0,
            pageSize: 20,
            onChange: setPage,
            showTotal: (total) => `${total} movements`,
          }}
        />
      </Card>

      <Modal
        title="Record Stock Movement"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={recordMutation.isPending}
        okText="Record"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => recordMutation.mutate(v)}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="movementType" label="Movement Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'IN', label: '⬆ IN — Receiving stock' },
                { value: 'OUT', label: '⬇ OUT — Sending / withdrawing stock' },
                { value: 'ADJUSTMENT', label: '↔ ADJUSTMENT — Correction' },
              ]}
            />
          </Form.Item>
          <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select product..."
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(products || []).map((p: any) => ({
                value: p.id,
                label: `${p.code} — ${p.name} (Stock: ${p.stockQuantity})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select
              options={(warehouses || []).map((w: any) => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} step={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unitCost" label="Unit Cost (optional)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reference" label="Reference (optional)">
            <Form.Item name="reference" noStyle>
              <input
                className="ant-input"
                placeholder="e.g. PO-001 or ADJ-REF"
                style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
              />
            </Form.Item>
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Form.Item name="notes" noStyle>
              <textarea
                className="ant-input"
                rows={2}
                placeholder="Reason or additional notes..."
                style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
              />
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import Stock from Excel"
        open={importModal}
        onCancel={resetImportModal}
        footer={null}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => downloadStockImportTemplate()}>
              Download Template
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleFileSelected}
            >
              <Button icon={<UploadOutlined />} loading={parsing}>
                Choose File
              </Button>
            </Upload>
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Columns: Code, Quantity, Warehouse (optional if you only have one warehouse), Unit Cost (optional), Notes (optional).
            Rows highlighted in red reference a product code or warehouse this doesn't recognize yet — fix those in the file and re-upload before importing.
          </Text>

          {importRows.length > 0 && (
            <Table
              size="small"
              columns={importPreviewColumns}
              dataSource={importRows}
              rowKey={(_, i) => String(i)}
              pagination={importRows.length > 10 ? { pageSize: 10 } : false}
            />
          )}

          {importResult && (
            <Alert
              type={importResult.failed === 0 ? 'success' : 'warning'}
              showIcon
              message={`${importResult.imported} imported, ${importResult.failed} failed`}
              description={
                importResult.errors.length > 0 ? (
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={importResult.errors}
                    rowKey={(e) => `${e.row}-${e.code}`}
                    columns={[
                      { title: 'Row', dataIndex: 'row', key: 'row', width: 70 },
                      { title: 'Code', dataIndex: 'code', key: 'code', width: 140 },
                      { title: 'Reason', dataIndex: 'reason', key: 'reason' },
                    ]}
                  />
                ) : undefined
              }
            />
          )}

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={resetImportModal}>Close</Button>
            <Button
              type="primary"
              disabled={importRows.length === 0}
              loading={bulkImportMutation.isPending}
              onClick={() => bulkImportMutation.mutate(importRows)}
            >
              Import {importRows.length > 0 ? `${importRows.length} Row(s)` : ''}
            </Button>
          </Space>
        </Space>
      </Modal>
    </Space>
  );
};
