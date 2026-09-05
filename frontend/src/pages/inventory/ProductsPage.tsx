import React, { useState } from 'react';
import {
  Table, Button, Card, Typography, Space,
  Input, Modal, Form, InputNumber, Tag, message, Select, Popconfirm, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined,
  WarningOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { inventoryApi } from '../../api/inventory.api';
import { formatCurrency } from '../../utils/format';
import type { Product, ProductCategory } from '../../types';

const { Title, Text } = Typography;
const { Search } = Input;

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#f5222d',
  '#722ed1', '#13c2c2', '#eb2f96', '#faad14',
  '#a0d911', '#2f54eb', '#fa541c', '#08979c',
];

interface ColorSwatchPickerProps {
  value?: string;
  onChange?: (v: string) => void;
}

const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {CATEGORY_COLORS.map((c) => (
      <div
        key={c}
        onClick={() => onChange?.(c)}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: c,
          cursor: 'pointer',
          border: value === c ? '3px solid #000' : '2px solid transparent',
          boxShadow: value === c ? '0 0 0 2px #fff inset' : undefined,
          flexShrink: 0,
        }}
      />
    ))}
    <Tooltip title="No color">
      <div
        onClick={() => onChange?.('')}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#f0f0f0',
          cursor: 'pointer',
          border: !value ? '3px solid #000' : '2px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#999',
          flexShrink: 0,
        }}
      >
        ✕
      </div>
    </Tooltip>
  </div>
);

interface ProductFormValues {
  code: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitPrice: number;
  taxRate?: number;
  reorderLevel?: number;
}

interface CategoryFormValues {
  name: string;
  color?: string;
  icon?: string;
}

export const ProductsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [productModal, setProductModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [productForm] = Form.useForm<ProductFormValues>();
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => inventoryApi.getProducts(search),
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: inventoryApi.getCategories,
  });

  const createMutation = useMutation({
    mutationFn: inventoryApi.createProduct,
    onSuccess: () => {
      message.success('Product created');
      setProductModal(false);
      setEditingProduct(null);
      productForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      inventoryApi.updateProduct(id, data),
    onSuccess: () => {
      message.success('Product updated');
      setProductModal(false);
      setEditingProduct(null);
      productForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to update product');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: inventoryApi.createCategory,
    onSuccess: (category) => {
      message.success('Category created');
      categoryForm.resetFields();
      setEditingCategory(null);
      productForm.setFieldValue('categoryId', category.id);
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryFormValues> }) =>
      inventoryApi.updateCategory(id, data),
    onSuccess: () => {
      message.success('Category updated');
      categoryForm.resetFields();
      setEditingCategory(null);
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to update category');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: inventoryApi.deleteCategory,
    onSuccess: () => {
      message.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to delete category');
    },
  });

  const openCreateProductModal = () => {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      taxRate: 0.16,
      reorderLevel: 10,
    });
    setProductModal(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    productForm.setFieldsValue({
      code: product.code,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId || undefined,
      unitPrice: Number(product.unitPrice),
      taxRate: Number(product.taxRate),
      reorderLevel: Number(product.reorderLevel || 0),
    });
    setProductModal(true);
  };

  const handleProductSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      const { code: _code, ...updateValues } = values;
      void _code;
      updateMutation.mutate({
        id: editingProduct.id,
        data: updateValues,
      });
      return;
    }

    createMutation.mutate(values);
  };

  const startEditCategory = (category: ProductCategory) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({
      name: category.name,
      color: category.color || '',
      icon: category.icon || '',
    });
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    categoryForm.resetFields();
  };

  const handleCategorySubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: values });
    } else {
      createCategoryMutation.mutate(values);
    }
  };

  const closeCategoryModal = () => {
    setCategoryModal(false);
    setEditingCategory(null);
    categoryForm.resetFields();
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 120 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Category',
      key: 'category',
      render: (_: unknown, record: Product) => (
        <Tag
          color={record.category?.color || (record.category ? 'blue' : 'default')}
          style={{ color: record.category?.color ? '#fff' : undefined }}
        >
          {record.category?.icon ? `${record.category.icon} ` : ''}{record.category?.name || 'Uncategorized'}
        </Tag>
      ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'price',
      align: 'right' as const,
      render: (v: number) => formatCurrency(Number(v)),
    },
    {
      title: 'Tax Rate',
      dataIndex: 'taxRate',
      key: 'tax',
      render: (v: number) => `${(Number(v) * 100).toFixed(0)}%`,
    },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      key: 'stock',
      align: 'right' as const,
      render: (v: number, record: Product) => {
        const qty = Number(v);
        const reorder = Number(record.reorderLevel || 0);
        return (
          <Space>
            <Text style={{ color: qty <= reorder ? '#f5222d' : '#52c41a' }}>
              {qty}
            </Text>
            {qty <= reorder && (
              <WarningOutlined style={{ color: '#fa8c16' }} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorderLevel',
      key: 'reorder',
      align: 'right' as const,
      render: (v: number) => Number(v),
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
      align: 'right' as const,
      render: (_: unknown, record: Product) => (
        <Button
          icon={<EditOutlined />}
          onClick={() => openEditProductModal(record)}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Products</Title>
        <Space>
          <Button onClick={() => setCategoryModal(true)}>Manage Categories</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateProductModal}>
            New Product
          </Button>
        </Space>
      </div>

      <Card>
        <Search
          placeholder="Search products..."
          prefix={<SearchOutlined />}
          style={{ width: 300, marginBottom: 16 }}
          onSearch={setSearch}
          onChange={(e) => !e.target.value && setSearch('')}
        />
        <Table
          columns={columns}
          dataSource={products || []}
          rowKey="id"
          loading={isLoading}
        />
      </Card>

      <Modal
        title={editingProduct ? 'Edit Product' : 'New Product'}
        open={productModal}
        onCancel={() => { setProductModal(false); setEditingProduct(null); productForm.resetFields(); }}
        onOk={() => productForm.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={productForm} layout="vertical" onFinish={handleProductSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Product Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. PROD-001" disabled={!!editingProduct} />
          </Form.Item>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input placeholder="Product name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select
              allowClear
              placeholder="Assign category"
              options={(categories || []).map((category: ProductCategory) => ({
                value: category.id,
                label: `${category.icon ? category.icon + ' ' : ''}${category.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="unitPrice" label="Unit Price (KES)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="taxRate" label="Tax Rate" initialValue={0.16}>
            <InputNumber
              style={{ width: '100%' }}
              min={0} max={1} step={0.01}
              formatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            />
          </Form.Item>
          <Form.Item name="reorderLevel" label="Reorder Level" initialValue={10}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Product Categories"
        open={categoryModal}
        onCancel={closeCategoryModal}
        onOk={() => categoryForm.submit()}
        okText={editingCategory ? 'Update Category' : 'Add Category'}
        confirmLoading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
        width={560}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Form form={categoryForm} layout="vertical" onFinish={handleCategorySubmit}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Form.Item name="icon" label="Icon" style={{ marginBottom: 0, width: 80 }}>
                <Input placeholder="🪑" maxLength={2} style={{ textAlign: 'center', fontSize: 18 }} />
              </Form.Item>
              <Form.Item name="name" label="Category Name" rules={[{ required: true }]} style={{ marginBottom: 0, flex: 1 }}>
                <Input placeholder="e.g. Furniture" />
              </Form.Item>
              {editingCategory && (
                <Button icon={<CloseOutlined />} onClick={cancelEditCategory} style={{ marginBottom: 0 }} />
              )}
            </div>
            <Form.Item name="color" label="Color" style={{ marginTop: 12, marginBottom: 0 }}>
              <ColorSwatchPicker />
            </Form.Item>
          </Form>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Existing categories</Text>
            <Space direction="vertical" style={{ width: '100%' }} size={0}>
              {(categories || []).map((category: ProductCategory) => {
                const isEditing = editingCategory?.id === category.id;
                return (
                  <div
                    key={category.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 4px',
                      borderBottom: '1px solid #f0f0f0',
                      background: isEditing ? '#fafafa' : undefined,
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: category.color || '#d9d9d9',
                        marginRight: 8,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ marginRight: 6, fontSize: 16, lineHeight: 1 }}>{category.icon || ''}</span>
                    <Text style={{ flex: 1 }}>{category.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 12 }}>
                      {category._count?.products || 0} products
                    </Text>
                    <Space size={4}>
                      <Button
                        size="small"
                        icon={isEditing ? <CheckOutlined /> : <EditOutlined />}
                        type={isEditing ? 'primary' : 'default'}
                        onClick={() => isEditing ? categoryForm.submit() : startEditCategory(category)}
                      />
                      <Popconfirm
                        title="Delete category?"
                        description={
                          (category._count?.products ?? 0) > 0
                            ? `${category._count!.products} product(s) use this category. Reassign them first.`
                            : 'This cannot be undone.'
                        }
                        onConfirm={() => deleteCategoryMutation.mutate(category.id)}
                        okButtonProps={{ disabled: (category._count?.products ?? 0) > 0 }}
                        okText="Delete"
                        okType="danger"
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                );
              })}
              {(categories || []).length === 0 && (
                <Text type="secondary" style={{ display: 'block', padding: '8px 0' }}>
                  No categories yet. Add one above.
                </Text>
              )}
            </Space>
          </div>
        </Space>
      </Modal>
    </Space>
  );
};
