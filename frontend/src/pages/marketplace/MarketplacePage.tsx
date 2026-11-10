import React, { useMemo, useState } from 'react';
import {
  Badge, Button, Card, Col, Form, Input, Modal, Rate, Row,
  Space, Tag, Tabs, Typography, message as antMessage, Tooltip,
  Divider, Select,
} from 'antd';
import {
  CheckCircleFilled, DownloadOutlined, GlobalOutlined,
  PlusOutlined, SearchOutlined, StarFilled, ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CATALOG, { CATEGORY_META, type MarketplaceCategory, type MarketplaceItem } from '../../data/marketplace.catalog';
import { pluginsApi } from '../../api/plugins.api';
import { settingsApi } from '../../api/settings.api';

const { Title, Text, Paragraph } = Typography;

// ─── Template / theme preview ─────────────────────────────────────────────────

const TemplatePreview: React.FC<{ item: MarketplaceItem }> = ({ item }) => {
  const c = item.previewColor ?? '#1677ff';

  if (item.category === 'invoice-templates') {
    return (
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, fontFamily: 'sans-serif' }}>
        {/* Header */}
        <div style={{ background: c, borderRadius: 6, padding: '10px 14px', color: '#fff', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>INVOICE</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>Your Company Name · PIN: P051234567X</div>
        </div>
        {/* Bill to */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Bill To</div>
            <div style={{ color: '#595959' }}>Customer Name<br />customer@email.com</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><span style={{ color: '#8c8c8c' }}>Invoice #</span> <strong>INV-0042</strong></div>
            <div><span style={{ color: '#8c8c8c' }}>Date</span> 10 Nov 2026</div>
            <div><span style={{ color: '#8c8c8c' }}>Due</span> 10 Dec 2026</div>
          </div>
        </div>
        {/* Table */}
        <div style={{ border: `1px solid ${c}30`, borderRadius: 4, overflow: 'hidden', fontSize: 10, marginBottom: 8 }}>
          <div style={{ background: c + '15', display: 'flex', padding: '4px 8px', fontWeight: 600, color: '#262626' }}>
            <span style={{ flex: 3 }}>Item</span><span style={{ flex: 1, textAlign: 'right' }}>Qty</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Price</span><span style={{ flex: 1, textAlign: 'right' }}>Total</span>
          </div>
          {[['Web Design Services', '1', '45,000', '45,000'], ['Hosting (1yr)', '1', '12,000', '12,000']].map(([n, q, p, t]) => (
            <div key={n} style={{ display: 'flex', padding: '3px 8px', borderTop: '1px solid #f0f0f0' }}>
              <span style={{ flex: 3, color: '#262626' }}>{n}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{q}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{p}</span>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{t}</span>
            </div>
          ))}
        </div>
        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11 }}>
          <div style={{ textAlign: 'right' }}>
            <div>Subtotal: KES 57,000</div>
            <div>VAT (16%): KES 9,120</div>
            <div style={{ fontWeight: 700, color: c, marginTop: 2 }}>Total: KES 66,120</div>
          </div>
        </div>
      </div>
    );
  }

  if (item.category === 'receipt-templates') {
    return (
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', padding: 12, fontFamily: 'monospace', fontSize: 11, maxWidth: 220, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, color: c, fontSize: 13 }}>YOUR STORE</div>
          <div style={{ color: '#8c8c8c', fontSize: 10 }}>Moi Avenue, Nairobi · 0712 345 678</div>
        </div>
        <div style={{ borderTop: '1px dashed #d9d9d9', borderBottom: '1px dashed #d9d9d9', padding: '5px 0', margin: '5px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bread 500g</span><span>KES 65</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Milk 1L</span><span>KES 75</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sugar 2kg</span><span>KES 230</span></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>TOTAL</span><span style={{ color: c }}>KES 370</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8c8c8c' }}><span>Cash</span><span>KES 400</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8c8c8c' }}><span>Change</span><span>KES 30</span></div>
        <div style={{ textAlign: 'center', marginTop: 8, color: '#8c8c8c', fontSize: 10 }}>Thank you for shopping with us!</div>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <div style={{ display: 'inline-block', width: 50, height: 50, background: '#f0f0f0', borderRadius: 4, lineHeight: '50px', textAlign: 'center', fontSize: 8, color: '#8c8c8c' }}>QR CODE</div>
        </div>
      </div>
    );
  }

  if (item.category === 'pos-themes') {
    return (
      <div style={{ background: c === '#141414' || c === '#531dab' ? '#000' : '#f5f5f5', borderRadius: 8, padding: 12 }}>
        {/* POS header */}
        <div style={{ background: c, borderRadius: 6, padding: '8px 12px', color: '#fff', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Nexus POS</span>
          <span style={{ fontSize: 11, opacity: 0.85 }}>Cashier: Admin</span>
        </div>
        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          {['Bread', 'Milk', 'Sugar', 'Rice', 'Eggs', 'Juice'].map((p) => (
            <div key={p} style={{ background: '#fff', borderRadius: 4, padding: '6px 4px', textAlign: 'center', border: `1px solid ${c}30`, fontSize: 10 }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>🛒</div>
              <div style={{ fontWeight: 600, color: '#262626', fontSize: 10 }}>{p}</div>
              <div style={{ color: c, fontWeight: 700, fontSize: 10 }}>KES 65</div>
            </div>
          ))}
        </div>
        {/* Cart total */}
        <div style={{ background: c, borderRadius: 6, padding: '8px 12px', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Total</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>KES 370</div>
          <div style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>Charge</div>
        </div>
      </div>
    );
  }

  return null;
};

// ─── Item detail modal ─────────────────────────────────────────────────────────

const ItemDetailModal: React.FC<{
  item: MarketplaceItem | null;
  installedIds: Set<string>;
  onClose: () => void;
  onInstall: (item: MarketplaceItem) => void;
}> = ({ item, installedIds, onClose, onInstall }) => {
  if (!item) return null;
  const isInstalled = installedIds.has(item.id);

  return (
    <Modal
      open={!!item}
      onCancel={onClose}
      footer={null}
      width={700}
      title={null}
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 48, lineHeight: 1, flexShrink: 0 }}>{item.logo}</div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0 }}>{item.name}</Title>
          <Text type="secondary">{item.tagline}</Text>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Rate disabled defaultValue={item.rating} style={{ fontSize: 13 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>({item.reviews} reviews)</Text>
            <Divider type="vertical" />
            <DownloadOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{item.installs.toLocaleString()} installs</Text>
            <Divider type="vertical" />
            <Text type="secondary" style={{ fontSize: 12 }}>By {item.author}</Text>
          </div>
        </div>
        {isInstalled ? (
          <Tag icon={<CheckCircleFilled />} color="success" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '4px 10px' }}>
            Installed
          </Tag>
        ) : (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { onInstall(item); onClose(); }} style={{ alignSelf: 'flex-start' }}>
            Install
          </Button>
        )}
      </div>

      {/* Preview */}
      {(item.category === 'invoice-templates' || item.category === 'receipt-templates' || item.category === 'pos-themes') && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Preview</Text>
          <TemplatePreview item={item} />
        </div>
      )}

      <Paragraph style={{ color: '#595959' }}>{item.description}</Paragraph>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
      </div>
    </Modal>
  );
};

// ─── Install / apply modal ─────────────────────────────────────────────────────

const InstallModal: React.FC<{
  item: MarketplaceItem | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const integrationMut = useMutation({
    mutationFn: (values: Record<string, any>) => {
      if (!item) throw new Error();
      const action = item.action as Extract<typeof item.action, { type: 'integration' }>;
      const isCustomPage = item.id === 'custom-page';
      return pluginsApi.registerPlugin({
        slug: isCustomPage ? undefined : action.slug,
        name: isCustomPage ? (values.pageLabel || 'Custom Page') : item.name,
        version: item.version,
        description: item.description,
        author: item.author,
        category: item.subcategory,
        config: isCustomPage ? {} : Object.fromEntries(action.configFields.map((f) => [f.key, values[f.key] ?? ''])),
        ...(isCustomPage && { pageUrl: values.pageUrl, pageLabel: values.pageLabel, pageIcon: 'GlobalOutlined' }),
      });
    },
    onSuccess: () => {
      antMessage.success(`${item!.name} installed!`);
      qc.invalidateQueries({ queryKey: ['plugins'] });
      qc.invalidateQueries({ queryKey: ['marketplace-installed'] });
      form.resetFields();
      onClose();
    },
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Install failed'),
  });

  const templateMut = useMutation({
    mutationFn: () => {
      if (!item) throw new Error();
      const a = item.action as Extract<typeof item.action, { type: 'invoice_template' | 'receipt_template' | 'pos_theme' }>;
      const patch =
        a.type === 'invoice_template' ? { invoiceTemplate: a.value } :
        a.type === 'receipt_template' ? { receiptTemplate: a.value } :
        a.type === 'pos_theme' ? { posTheme: a.value } : {};
      return settingsApi.updateSystemSettings(patch as any);
    },
    onSuccess: () => {
      antMessage.success(`${item!.name} applied!`);
      qc.invalidateQueries({ queryKey: ['system-settings'] });
      qc.invalidateQueries({ queryKey: ['marketplace-installed'] });
      onClose();
    },
    onError: (e: any) => antMessage.error(e?.response?.data?.message ?? 'Failed to apply'),
  });

  if (!item) return null;

  const isTemplate = item.action.type === 'invoice_template' || item.action.type === 'receipt_template' || item.action.type === 'pos_theme';
  const isCustomPage = item.id === 'custom-page';
  const action = item.action;

  if (isTemplate) {
    return (
      <Modal
        open
        title={<Space><span style={{ fontSize: 20 }}>{item.logo}</span><span>Apply {item.name}</span></Space>}
        onCancel={onClose}
        onOk={() => templateMut.mutate()}
        confirmLoading={templateMut.isPending}
        okText="Apply Template"
        width={600}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>{item.description}</Paragraph>
        <TemplatePreview item={item} />
        {item.builtIn && <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>This template is built-in and will be applied immediately.</Text>}
      </Modal>
    );
  }

  const configFields = action.type === 'integration' ? action.configFields :
    isCustomPage ? [
      { key: 'pageUrl', label: 'Page URL', placeholder: 'https://mytool.example.com', required: true },
      { key: 'pageLabel', label: 'Sidebar Label', placeholder: 'My Tool', required: true },
    ] : [];

  return (
    <Modal
      open
      title={<Space><span style={{ fontSize: 20 }}>{item.logo}</span><span>Install {item.name}</span></Space>}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={() => form.validateFields().then((v) => integrationMut.mutate(v))}
      confirmLoading={integrationMut.isPending}
      okText="Install"
      width={520}
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>{item.tagline}</Paragraph>
      <Form form={form} layout="vertical">
        {configFields.map((f: any) => (
          <Form.Item key={f.key} name={f.key} label={f.label}
            rules={f.required ? [{ required: true, message: `${f.label} is required` }] : []}>
            {f.secret ? <Input.Password placeholder={f.placeholder} /> : <Input placeholder={f.placeholder} />}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
};

// ─── Item card ────────────────────────────────────────────────────────────────

const ItemCard: React.FC<{
  item: MarketplaceItem;
  installed: boolean;
  onDetail: (i: MarketplaceItem) => void;
  onInstall: (i: MarketplaceItem) => void;
}> = ({ item, installed, onDetail, onInstall }) => (
  <Card
    hoverable
    size="small"
    styles={{ body: { padding: 16 } }}
    onClick={() => onDetail(item)}
    style={{ height: '100%', cursor: 'pointer' }}
  >
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{item.logo}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 14 }}>{item.name}</Text>
            {item.featured && <Tag color="gold" style={{ marginLeft: 6, fontSize: 10 }}>Featured</Tag>}
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{item.tagline}</Text>
          </div>
          {installed ? (
            <Tag icon={<CheckCircleFilled />} color="success" style={{ flexShrink: 0 }}>Installed</Tag>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              style={{ flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onInstall(item); }}
            >
              {item.action.type.startsWith('invoice_') || item.action.type.startsWith('receipt_') || item.action.type === 'pos_theme' ? 'Apply' : 'Install'}
            </Button>
          )}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Rate disabled defaultValue={item.rating} style={{ fontSize: 11 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>{item.rating.toFixed(1)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>·</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{item.installs.toLocaleString()} installs</Text>
          <Tag style={{ fontSize: 10, margin: 0 }}>{item.subcategory}</Tag>
        </div>
      </div>
    </div>
  </Card>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const MarketplacePage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const [installItem, setInstallItem] = useState<MarketplaceItem | null>(null);

  // Fetch installed plugins + current settings to know what's "installed"
  const { data: plugins = [] } = useQuery({ queryKey: ['plugins'], queryFn: pluginsApi.getPlugins });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: settingsApi.getSystemSettings });

  // Build set of installed item IDs
  const installedIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    // Apps
    plugins.forEach((p) => { if (p.slug) ids.add(p.slug); if (p.id) ids.add(p.id); });
    // Templates
    if (settings?.invoiceTemplate) {
      CATALOG.filter((c) => c.action.type === 'invoice_template' && (c.action as any).value === settings.invoiceTemplate)
        .forEach((c) => ids.add(c.id));
    }
    if (settings?.receiptTemplate) {
      CATALOG.filter((c) => c.action.type === 'receipt_template' && (c.action as any).value === settings.receiptTemplate)
        .forEach((c) => ids.add(c.id));
    }
    if (settings?.posTheme) {
      CATALOG.filter((c) => c.action.type === 'pos_theme' && (c.action as any).value === settings.posTheme)
        .forEach((c) => ids.add(c.id));
    }
    return ids;
  }, [plugins, settings]);

  const filtered = useMemo(() => {
    let items = CATALOG;
    if (category !== 'all') items = items.filter((i) => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.tagline.toLowerCase().includes(q) ||
        i.tags.some((t) => t.includes(q)) ||
        i.subcategory.toLowerCase().includes(q),
      );
    }
    return items;
  }, [category, search]);

  const featured = useMemo(() => CATALOG.filter((i) => i.featured).slice(0, 4), []);
  const stats = { total: CATALOG.length, installed: installedIds.size, free: CATALOG.filter((i) => i.price === 'Free').length };

  const handleInstall = (item: MarketplaceItem) => setInstallItem(item);

  return (
    <div>
      <ItemDetailModal
        item={detailItem}
        installedIds={installedIds}
        onClose={() => setDetailItem(null)}
        onInstall={handleInstall}
      />
      {installItem && <InstallModal item={installItem} onClose={() => setInstallItem(null)} />}

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
        borderRadius: 12, padding: '28px 32px', marginBottom: 24, color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>Nexus Marketplace</Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
              Extend your ERP with integrations, templates, and themes
            </Text>
            <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
              {[
                { n: stats.total, label: 'Apps & Templates' },
                { n: stats.free, label: 'Free' },
                { n: stats.installed, label: 'Installed' },
              ].map(({ n, label }) => (
                <div key={label}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <Input
            placeholder="Search apps, templates…"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
        </div>
      </div>

      {/* Featured (shown when no search/filter) */}
      {!search && category === 'all' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <Title level={5} style={{ margin: 0 }}>Featured</Title>
          </div>
          <Row gutter={[12, 12]}>
            {featured.map((item) => (
              <Col xs={24} sm={12} key={item.id}>
                <ItemCard item={item} installed={installedIds.has(item.id)} onDetail={setDetailItem} onInstall={handleInstall} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Category tabs + grid */}
      <Tabs
        activeKey={category}
        onChange={(k) => setCategory(k as any)}
        tabBarExtraContent={
          <Text type="secondary" style={{ fontSize: 12 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</Text>
        }
        items={[
          { key: 'all', label: <Space><AppstoreOutlined />All</Space> },
          ...Object.entries(CATEGORY_META).map(([key, meta]) => ({
            key,
            label: (
              <Space>
                <span>{meta.icon}</span>
                {meta.label}
                <Badge
                  count={CATALOG.filter((i) => i.category === key).length}
                  color="blue" size="small"
                />
              </Space>
            ),
          })),
        ]}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8c8c8c' }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <Title level={5} style={{ color: '#8c8c8c' }}>No results for "{search}"</Title>
          <Text type="secondary">Try a different keyword or browse by category</Text>
        </div>
      ) : (
        <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
          {filtered.map((item) => (
            <Col xs={24} sm={12} lg={8} key={item.id}>
              <ItemCard item={item} installed={installedIds.has(item.id)} onDetail={setDetailItem} onInstall={handleInstall} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default MarketplacePage;
