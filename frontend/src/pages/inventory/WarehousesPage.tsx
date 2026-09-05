import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Modal, Form, Input, message, Tag,
} from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';

const { Title } = Typography;

export const WarehousesPage: React.FC = () => {
  const [modal, setModal] = useState(false);
  const [stockModal, setStockModal] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  const createMutation = useMutation({
    mutationFn: inventoryApi.createWarehouse,
    onSuccess: () => {
      message.success('Warehouse created');
      setModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed');
    },
  });

  const { data: warehouseStock } = useQuery({
    queryKey: ['warehouse-stock', stockModal?.id],
    queryFn: () => inventoryApi.getWarehouseStock(stockModal?.id),
    enabled: !!stockModal?.id,
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (v: string) => v || '—',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setStockModal(record)}
        >
          View Stock
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Warehouses</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>
          New Warehouse
        </Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={warehouses || []} rowKey="id" loading={isLoading} />
      </Card>

      <Modal
        title="New Warehouse"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Warehouse Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Main Warehouse" />
          </Form.Item>
          <Form.Item name="location" label="Location">
            <Input placeholder="e.g. Nairobi, Kenya" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Stock Modal */}
      <Modal
        title={`Stock — ${stockModal?.name}`}
        open={!!stockModal}
        onCancel={() => setStockModal(null)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={warehouseStock?.stock || []}
          rowKey={(r: any) => r.product?.id}
          pagination={false}
          size="small"
          columns={[
            { title: 'Product', dataIndex: ['product', 'name'], key: 'name' },
            { title: 'Code', dataIndex: ['product', 'code'], key: 'code' },
            {
              title: 'Qty',
              dataIndex: 'quantity',
              key: 'qty',
              align: 'right' as const,
            },
          ]}
        />
      </Modal>
    </Space>
  );
};
