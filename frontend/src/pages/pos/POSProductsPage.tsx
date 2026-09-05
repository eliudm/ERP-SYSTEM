import React, { useState } from 'react';
import {
  Button, Card, Col, Input, Row, Space, Switch, Tag, Tooltip, Typography,
  Modal, Form, Popconfirm, message,
} from 'antd';
import {
  SearchOutlined, CheckOutlined, CloseOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api/inventory.api';
import { formatCurrency } from '../../utils/format';
import type { Product, ProductCategory } from '../../types';

const { Title, Text } = Typography;

const COLOR_PRESETS = [
  '#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1',
  '#13c2c2', '#f5222d', '#2f54eb', '#faad14', '#a0d911',
];

interface CategoryFormValues {
  name: string;
  color?: string;
  icon?: string;
}

export const POSProductsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [form] = Form.useForm<CategoryFormValues>();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, categoryId],
    queryFn: () => inventoryApi.getProducts(search, categoryId),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: inventoryApi.getCategories,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      inventoryApi.updateProduct(id, { isActive: available } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormValues) => inventoryApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      message.success('Category created');
      setModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormValues }) =>
      inventoryApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      message.success('Category updated');
      setModalOpen(false);
      form.resetFields();
      setEditingCat(null);
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      message.success('Category deleted');
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to delete category'),
  });

  const openCreate = () => {
    setEditingCat(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (cat: ProductCategory) => {
    setEditingCat(cat);
    form.setFieldsValue({ name: cat.name, color: cat.color ?? '', icon: cat.icon ?? '' });
    setModalOpen(true);
  };

  const handleSubmit = (values: CategoryFormValues) => {
    if (editingCat) {
      updateMutation.mutate({ id: editingCat.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Products</Title>
      </div>

      {/* ── Categories row ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Button
          shape="round"
          type={!categoryId ? 'primary' : 'default'}
          onClick={() => setCategoryId(undefined)}
        >
          All
        </Button>

        {(categories as ProductCategory[]).map((cat) => {
          const active = categoryId === cat.id;
          const color = cat.color || '#1677ff';
          return (
            <div key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Button
                shape="round"
                onClick={() => setCategoryId(cat.id)}
                style={
                  active
                    ? { background: color, borderColor: color, color: '#fff' }
                    : { borderColor: color, color }
                }
              >
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                {cat._count ? (
                  <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>
                    ({cat._count.products})
                  </span>
                ) : null}
              </Button>
              <Tooltip title="Edit">
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined style={{ fontSize: 11 }} />}
                  onClick={() => openEdit(cat)}
                  style={{ padding: '0 4px', minWidth: 22, height: 22 }}
                />
              </Tooltip>
              <Popconfirm
                title={`Delete "${cat.name}"?`}
                description={
                  cat._count?.products
                    ? `This category has ${cat._count.products} product(s) and cannot be deleted.`
                    : 'This action cannot be undone.'
                }
                onConfirm={() => {
                  if (!cat._count?.products) deleteMutation.mutate(cat.id);
                }}
                okButtonProps={{ disabled: !!cat._count?.products, danger: true }}
                okText="Delete"
              >
                <Tooltip title="Delete">
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                    loading={deleteMutation.isPending}
                    style={{ padding: '0 4px', minWidth: 22, height: 22 }}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          );
        })}

        <Button
          shape="round"
          icon={<PlusOutlined />}
          onClick={openCreate}
          style={{ borderStyle: 'dashed' }}
        >
          Add Category
        </Button>
      </div>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 360 }}
      />

      <Row gutter={[16, 16]}>
        {(products as Product[]).map((product) => {
          const available = (product as any).availableInPos !== false;
          return (
            <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${available ? '#b7eb8f' : '#f0f0f0'}`,
                  background: available ? '#f6ffed' : '#fafafa',
                }}
                bodyStyle={{ padding: 14 }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text
                      strong
                      style={{
                        fontSize: 13,
                        maxWidth: '75%',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.name}
                    </Text>
                    <Tooltip title={available ? 'Remove from POS' : 'Add to POS'}>
                      <Switch
                        size="small"
                        checked={available}
                        loading={toggleMutation.isPending}
                        checkedChildren={<CheckOutlined />}
                        unCheckedChildren={<CloseOutlined />}
                        onChange={(v) => toggleMutation.mutate({ id: product.id, value: v } as any)}
                      />
                    </Tooltip>
                  </div>
                  {product.category && (
                    <Tag
                      color={product.category.color || 'blue'}
                      style={{ fontSize: 10, margin: 0 }}
                    >
                      {product.category.icon ? `${product.category.icon} ` : ''}{product.category.name}
                    </Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>{product.code}</Text>
                  <Text style={{ color: '#1677ff', fontWeight: 600, fontSize: 14 }}>
                    {formatCurrency(Number(product.unitPrice))}
                  </Text>
                  <Tag
                    color={
                      Number(product.stockQuantity) > (product.reorderLevel ?? 5)
                        ? 'green'
                        : Number(product.stockQuantity) > 0
                        ? 'orange'
                        : 'red'
                    }
                    style={{ fontSize: 10 }}
                  >
                    Stock: {Number(product.stockQuantity)}
                  </Tag>
                </Space>
              </Card>
            </Col>
          );
        })}

        {!isLoading && (products as Product[]).length === 0 && (
          <Col span={24}>
            <Text type="secondary">No products found.</Text>
          </Col>
        )}
      </Row>

      {/* ── Category modal ─────────────────────────────────────── */}
      <Modal
        title={editingCat ? 'Edit Category' : 'New Category'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingCat(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editingCat ? 'Save Changes' : 'Create'}
        confirmLoading={isSaving}
        destroyOnClose
        width={420}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. Beverages" maxLength={60} />
          </Form.Item>

          <Form.Item name="icon" label="Icon (emoji)">
            <Input placeholder="e.g. 🍔" maxLength={4} style={{ width: 80 }} />
          </Form.Item>

          <Form.Item name="color" label="Color">
            <Input placeholder="#1677ff" maxLength={20} style={{ width: 130 }} />
          </Form.Item>

          {/* Quick color presets */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -8, marginBottom: 8 }}>
            {COLOR_PRESETS.map((c) => (
              <div
                key={c}
                onClick={() => form.setFieldValue('color', c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  outline: form.getFieldValue('color') === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>

          {/* Live preview */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const name = getFieldValue('name') || 'Preview';
              const icon = getFieldValue('icon') || '';
              const color = getFieldValue('color') || '#1677ff';
              return (
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Preview</Text>
                  <div style={{ marginTop: 4 }}>
                    <Button
                      shape="round"
                      size="small"
                      style={{ background: color, borderColor: color, color: '#fff', pointerEvents: 'none' }}
                    >
                      {icon ? `${icon} ` : ''}{name}
                    </Button>
                  </div>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default POSProductsPage;
