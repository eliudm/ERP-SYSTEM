export type MarketplaceCategory = 'apps' | 'invoice-templates' | 'receipt-templates' | 'pos-themes' | 'widgets';

export type InstallAction =
  | { type: 'integration'; slug: string; configFields: ConfigField[] }
  | { type: 'invoice_template'; value: string }
  | { type: 'receipt_template'; value: string }
  | { type: 'pos_theme'; value: string }
  | { type: 'widget'; widgetId: string }
  | { type: 'custom_page' };

export interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: MarketplaceCategory;
  subcategory: string;
  author: string;
  version: string;
  price: 'Free' | string;
  rating: number;      // 0-5
  reviews: number;
  installs: number;
  logo: string;        // emoji
  tags: string[];
  featured?: boolean;
  builtIn?: boolean;   // already installed / built into the system
  screenshots?: string[]; // description of preview panels
  action: InstallAction;
  previewColor?: string; // accent color for template preview
}

const CATALOG: MarketplaceItem[] = [
  // ── APPS ─────────────────────────────────────────────────────────────────
  {
    id: 'shopify', name: 'Shopify', tagline: 'Sync your Shopify store',
    description: 'Two-way sync of orders, products, inventory, and customers between Shopify and Nexus ERP. Automatically create sales invoices for new Shopify orders and push stock levels back to your storefront.',
    category: 'apps', subcategory: 'E-commerce', author: 'Nexus Labs',
    version: '2.1.0', price: 'Free', rating: 4.8, reviews: 142, installs: 1240,
    logo: '🛍️', tags: ['ecommerce', 'sync', 'orders', 'shopify'], featured: true,
    action: { type: 'integration', slug: 'shopify', configFields: [
      { key: 'shopName', label: 'Shop Name', placeholder: 'mystore.myshopify.com', required: true },
      { key: 'accessToken', label: 'Admin Access Token', placeholder: 'shpat_...', secret: true, required: true },
      { key: 'webhookSecret', label: 'Webhook Secret', placeholder: 'Optional signing secret', secret: true },
    ]},
  },
  {
    id: 'woocommerce', name: 'WooCommerce', tagline: 'Connect your WordPress store',
    description: 'Integrate your WooCommerce store with Nexus ERP for automatic order processing, inventory sync, and customer management. Supports variable products, coupons, and refunds.',
    category: 'apps', subcategory: 'E-commerce', author: 'Nexus Labs',
    version: '1.4.0', price: 'Free', rating: 4.6, reviews: 98, installs: 980,
    logo: '🛒', tags: ['ecommerce', 'wordpress', 'woo'],
    action: { type: 'integration', slug: 'woocommerce', configFields: [
      { key: 'siteUrl', label: 'WordPress Site URL', placeholder: 'https://mystore.com', required: true },
      { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_...', secret: true, required: true },
      { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_...', secret: true, required: true },
    ]},
  },
  {
    id: 'quickbooks', name: 'QuickBooks Online', tagline: 'Accounting sync with QuickBooks',
    description: 'Sync invoices, payments, expenses, and your chart of accounts with QuickBooks Online. Keep your accountant happy without double entry.',
    category: 'apps', subcategory: 'Accounting', author: 'Nexus Labs',
    version: '1.2.0', price: 'Free', rating: 4.7, reviews: 76, installs: 760,
    logo: '📊', tags: ['accounting', 'quickbooks', 'sync'], featured: true,
    action: { type: 'integration', slug: 'quickbooks', configFields: [
      { key: 'clientId', label: 'Client ID', required: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true, required: true },
      { key: 'realmId', label: 'Company (Realm) ID', required: true },
    ]},
  },
  {
    id: 'xero', name: 'Xero', tagline: 'Sync with Xero accounting',
    description: 'Connect Nexus ERP to Xero for seamless bank transaction import, invoice export, and automatic reconciliation.',
    category: 'apps', subcategory: 'Accounting', author: 'Nexus Labs',
    version: '1.1.0', price: 'Free', rating: 4.5, reviews: 54, installs: 540,
    logo: '🔵', tags: ['accounting', 'xero', 'reconciliation'],
    action: { type: 'integration', slug: 'xero', configFields: [
      { key: 'clientId', label: 'Client ID', required: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true, required: true },
      { key: 'tenantId', label: 'Tenant ID', required: true },
    ]},
  },
  {
    id: 'flutterwave', name: 'Flutterwave', tagline: 'Accept payments across Africa',
    description: 'Accept card, mobile money, USSD, and bank transfer payments via Flutterwave. Auto-create payment receipts and reconcile against invoices.',
    category: 'apps', subcategory: 'Payments', author: 'Nexus Labs',
    version: '1.3.0', price: 'Free', rating: 4.8, reviews: 112, installs: 890,
    logo: '💳', tags: ['payments', 'flutterwave', 'africa', 'mpesa'], featured: true,
    action: { type: 'integration', slug: 'flutterwave', configFields: [
      { key: 'publicKey', label: 'Public Key', placeholder: 'FLWPUBK_TEST-...', required: true },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'FLWSECK_TEST-...', secret: true, required: true },
      { key: 'encryptionKey', label: 'Encryption Key', secret: true },
    ]},
  },
  {
    id: 'africas-talking', name: "Africa's Talking", tagline: 'SMS & USSD for Africa',
    description: "Send bulk SMS, payment notifications, and USSD menus via Africa's Talking — covering Kenya, Uganda, Tanzania, Nigeria, and more.",
    category: 'apps', subcategory: 'Communication', author: 'Nexus Labs',
    version: '2.0.0', price: 'Free', rating: 4.7, reviews: 134, installs: 1100,
    logo: '📱', tags: ['sms', 'ussd', 'africa', 'notifications'],
    action: { type: 'integration', slug: 'africas-talking', configFields: [
      { key: 'username', label: 'Username', required: true },
      { key: 'apiKey', label: 'API Key', secret: true, required: true },
      { key: 'senderId', label: 'Sender ID / Shortcode', placeholder: 'e.g. NEXUS' },
    ]},
  },
  {
    id: 'sendgrid', name: 'SendGrid Email', tagline: 'Transactional email delivery',
    description: 'Send beautiful HTML invoices, statements, and receipts by email via SendGrid. Track opens and delivery status.',
    category: 'apps', subcategory: 'Communication', author: 'Nexus Labs',
    version: '1.0.0', price: 'Free', rating: 4.6, reviews: 65, installs: 650,
    logo: '✉️', tags: ['email', 'sendgrid', 'transactional'],
    action: { type: 'integration', slug: 'sendgrid', configFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'SG.xxx', secret: true, required: true },
      { key: 'fromEmail', label: 'From Email', placeholder: 'noreply@mycompany.com', required: true },
      { key: 'fromName', label: 'From Name', placeholder: 'My Company' },
    ]},
  },
  {
    id: 'sendit', name: 'SendIT Courier', tagline: 'Last-mile delivery in Kenya',
    description: 'Create pickup and delivery orders with SendIT directly from Nexus ERP. Track shipments and auto-update order status.',
    category: 'apps', subcategory: 'Logistics', author: 'Nexus Labs',
    version: '1.0.0', price: 'Free', rating: 4.3, reviews: 28, installs: 280,
    logo: '📦', tags: ['logistics', 'delivery', 'kenya', 'courier'],
    action: { type: 'integration', slug: 'sendit', configFields: [
      { key: 'apiKey', label: 'API Key', secret: true, required: true },
      { key: 'username', label: 'Username', required: true },
    ]},
  },
  {
    id: 'google-sheets', name: 'Google Sheets Sync', tagline: 'Export data to Sheets',
    description: 'Automatically sync sales reports, inventory levels, and payroll summaries to Google Sheets for custom analysis and dashboards.',
    category: 'apps', subcategory: 'Productivity', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.4, reviews: 56, installs: 560,
    logo: '📋', tags: ['google', 'sheets', 'export', 'reports'],
    action: { type: 'integration', slug: 'google-sheets', configFields: [
      { key: 'serviceAccountJson', label: 'Service Account JSON', placeholder: '{"type":"service_account",...}', required: true },
      { key: 'spreadsheetId', label: 'Spreadsheet ID', required: true },
    ]},
  },
  {
    id: 'webhook-receiver', name: 'Webhook Receiver', tagline: 'Accept external webhooks',
    description: 'Receive incoming webhooks from any external service and map them to ERP actions. Great for custom integrations without a dedicated connector.',
    category: 'apps', subcategory: 'Developer', author: 'Built-in',
    version: '1.0.0', price: 'Free', rating: 4.9, reviews: 210, installs: 2100,
    logo: '🔗', tags: ['webhook', 'api', 'developer', 'integration'],
    action: { type: 'integration', slug: 'webhook-receiver', configFields: [
      { key: 'secret', label: 'Signing Secret (optional)', secret: true },
      { key: 'eventMapping', label: 'Event Mapping (JSON)', placeholder: '{"order.created":"invoice.create"}' },
    ]},
  },
  {
    id: 'custom-page', name: 'Custom Embedded Page', tagline: 'Embed any web app',
    description: 'Add any external web application as a full sidebar page inside Nexus ERP. Works with internal tools, BI dashboards, Notion, Airtable, and more.',
    category: 'apps', subcategory: 'Custom', author: 'Built-in',
    version: '1.0.0', price: 'Free', rating: 4.5, reviews: 87, installs: 870,
    logo: '🖥️', tags: ['iframe', 'embed', 'custom', 'tool'],
    action: { type: 'custom_page' },
  },

  // ── INVOICE TEMPLATES ─────────────────────────────────────────────────────
  {
    id: 'invoice-modern', name: 'Modern', tagline: 'Clean blue header with logo',
    description: 'The default template. Features a full-width blue header with your company logo, clean line items table, and a subtle footer.',
    category: 'invoice-templates', subcategory: 'Professional', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.7, reviews: 320, installs: 3200,
    logo: '📄', tags: ['modern', 'default', 'blue'], builtIn: true, previewColor: '#1677ff',
    action: { type: 'invoice_template', value: 'modern' },
  },
  {
    id: 'invoice-classic', name: 'Classic', tagline: 'Traditional bordered layout',
    description: 'A timeless invoice layout with bordered cells, traditional typography, and a formal look trusted by accountants everywhere.',
    category: 'invoice-templates', subcategory: 'Traditional', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.5, reviews: 215, installs: 2150,
    logo: '📋', tags: ['classic', 'traditional', 'formal'], builtIn: true, previewColor: '#595959',
    action: { type: 'invoice_template', value: 'classic' },
  },
  {
    id: 'invoice-minimal', name: 'Minimal', tagline: 'Ultra-clean, no borders',
    description: 'A stripped-back invoice with no borders, generous white space, and typography-only hierarchy. Perfect for modern brands.',
    category: 'invoice-templates', subcategory: 'Minimal', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.6, reviews: 178, installs: 1780,
    logo: '⬜', tags: ['minimal', 'clean', 'modern'], builtIn: true, previewColor: '#8c8c8c',
    action: { type: 'invoice_template', value: 'minimal' },
  },
  {
    id: 'invoice-corporate', name: 'Corporate Blue', tagline: 'Professional with sidebar',
    description: 'Two-column design with a navy sidebar showing company details, and a crisp white right panel for line items. Projects authority and professionalism.',
    category: 'invoice-templates', subcategory: 'Professional', author: 'Nexus Design',
    version: '1.1.0', price: 'Free', rating: 4.9, reviews: 94, installs: 940,
    logo: '🔷', tags: ['corporate', 'navy', 'sidebar', 'professional'], featured: true, previewColor: '#003a8c',
    action: { type: 'invoice_template', value: 'corporate' },
  },
  {
    id: 'invoice-executive', name: 'Executive Dark', tagline: 'Dark header with gold accents',
    description: 'Bold dark header with gold accent lines and a premium feel. Best suited for high-value services, consulting, and luxury products.',
    category: 'invoice-templates', subcategory: 'Premium', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.8, reviews: 67, installs: 670,
    logo: '🖤', tags: ['dark', 'gold', 'executive', 'premium'], previewColor: '#141414',
    action: { type: 'invoice_template', value: 'executive' },
  },
  {
    id: 'invoice-kra', name: 'Kenya Standard (KRA)', tagline: 'eTIMS-ready KRA layout',
    description: 'Fully compliant Kenya Revenue Authority invoice layout. Includes eTIMS QR code placement, PIN fields, VAT breakdown, and all mandatory KRA fields.',
    category: 'invoice-templates', subcategory: 'Compliance', author: 'Nexus Labs',
    version: '2.0.0', price: 'Free', rating: 4.9, reviews: 189, installs: 1890,
    logo: '🇰🇪', tags: ['kra', 'etims', 'kenya', 'vat', 'compliance'], featured: true, previewColor: '#006633',
    action: { type: 'invoice_template', value: 'kra' },
  },
  {
    id: 'invoice-creative', name: 'Creative Studio', tagline: 'Colorful for creative agencies',
    description: 'Vibrant gradient header, project-based line items, and a playful footer. Perfect for design agencies, photographers, and creative freelancers.',
    category: 'invoice-templates', subcategory: 'Creative', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.4, reviews: 42, installs: 420,
    logo: '🎨', tags: ['creative', 'colorful', 'agency', 'gradient'], previewColor: '#722ed1',
    action: { type: 'invoice_template', value: 'creative' },
  },
  {
    id: 'invoice-simple', name: 'Simple Clean', tagline: 'Maximum clarity, zero clutter',
    description: 'No header graphics, no color — just clean text with smart spacing. Loads and prints fast, looks great on any device.',
    category: 'invoice-templates', subcategory: 'Minimal', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.3, reviews: 38, installs: 380,
    logo: '📃', tags: ['simple', 'print', 'minimal', 'text-only'], previewColor: '#d9d9d9',
    action: { type: 'invoice_template', value: 'simple' },
  },

  // ── RECEIPT TEMPLATES ─────────────────────────────────────────────────────
  {
    id: 'receipt-standard', name: 'Standard Receipt', tagline: 'The classic POS receipt',
    description: 'The default POS receipt. Clear itemisation, payment summary, and change due. Works with 80mm and A4 paper.',
    category: 'receipt-templates', subcategory: 'Standard', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.6, reviews: 280, installs: 2800,
    logo: '🧾', tags: ['standard', 'default', 'pos'], builtIn: true, previewColor: '#1677ff',
    action: { type: 'receipt_template', value: 'standard' },
  },
  {
    id: 'receipt-compact', name: 'Compact', tagline: 'Space-saving layout',
    description: 'Smaller font size and tighter line spacing to fit more items on shorter paper rolls. Ideal for high-volume checkout.',
    category: 'receipt-templates', subcategory: 'Compact', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.4, reviews: 145, installs: 1450,
    logo: '📜', tags: ['compact', 'space-saving', 'thermal'], builtIn: true, previewColor: '#595959',
    action: { type: 'receipt_template', value: 'compact' },
  },
  {
    id: 'receipt-branded', name: 'Branded', tagline: 'Full company branding',
    description: 'Your logo printed prominently at the top, company colours in the header, and a branded footer with social handles and website.',
    category: 'receipt-templates', subcategory: 'Branded', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.7, reviews: 192, installs: 1920,
    logo: '🏷️', tags: ['branded', 'logo', 'marketing'], builtIn: true, previewColor: '#1677ff',
    action: { type: 'receipt_template', value: 'branded' },
  },
  {
    id: 'receipt-thermal58', name: 'Thermal 58mm', tagline: 'Optimised for 58mm printers',
    description: 'Narrower layout (58mm width) with smaller font and 1-column format. Perfect for small desktop or Bluetooth thermal printers.',
    category: 'receipt-templates', subcategory: 'Thermal', author: 'Nexus Labs',
    version: '1.1.0', price: 'Free', rating: 4.5, reviews: 78, installs: 780,
    logo: '🖨️', tags: ['thermal', '58mm', 'bluetooth', 'compact'], featured: true, previewColor: '#8c8c8c',
    action: { type: 'receipt_template', value: 'thermal58' },
  },
  {
    id: 'receipt-detailed', name: 'Detailed POS', tagline: 'More product info on receipt',
    description: 'Shows SKU codes, lot numbers, batch info, and unit prices alongside line totals. Great for pharmacies, hardware stores, and technical retailers.',
    category: 'receipt-templates', subcategory: 'Detailed', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.3, reviews: 44, installs: 440,
    logo: '📋', tags: ['detailed', 'sku', 'pharmacy', 'hardware'], previewColor: '#389e0d',
    action: { type: 'receipt_template', value: 'detailed' },
  },
  {
    id: 'receipt-whatsapp', name: 'WhatsApp Receipt', tagline: 'Send receipt via WhatsApp',
    description: 'Formats the receipt as a WhatsApp message with emoji line items and a payment summary. Sent automatically on checkout via the Messaging module.',
    category: 'receipt-templates', subcategory: 'Digital', author: 'Nexus Labs',
    version: '1.0.0', price: 'Free', rating: 4.8, reviews: 103, installs: 1030,
    logo: '💬', tags: ['whatsapp', 'digital', 'sms', 'send'], featured: true, previewColor: '#25d366',
    action: { type: 'receipt_template', value: 'whatsapp' },
  },

  // ── POS THEMES ───────────────────────────────────────────────────────────
  {
    id: 'theme-ocean', name: 'Ocean Blue', tagline: 'The default clean blue theme',
    description: 'Professional blue and white POS theme. Easy on the eyes for long shifts, with high contrast for fast product recognition.',
    category: 'pos-themes', subcategory: 'Light', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.7, reviews: 220, installs: 2200,
    logo: '🌊', tags: ['blue', 'default', 'light'], builtIn: true, previewColor: '#1677ff',
    action: { type: 'pos_theme', value: 'ocean' },
  },
  {
    id: 'theme-dark', name: 'Dark Professional', tagline: 'Easy on eyes at night',
    description: 'Full dark mode for the POS terminal. Reduces eye strain during night shifts and in low-light retail environments. Bright product cards on dark background.',
    category: 'pos-themes', subcategory: 'Dark', author: 'Nexus Design',
    version: '1.2.0', price: 'Free', rating: 4.9, reviews: 187, installs: 1870,
    logo: '🌑', tags: ['dark', 'night', 'low-light'], featured: true, previewColor: '#141414',
    action: { type: 'pos_theme', value: 'dark' },
  },
  {
    id: 'theme-emerald', name: 'Emerald Fresh', tagline: 'Fresh green for retail',
    description: 'Vibrant green theme evoking freshness and health. Popular with supermarkets, pharmacies, and food retailers.',
    category: 'pos-themes', subcategory: 'Light', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.5, reviews: 68, installs: 680,
    logo: '💚', tags: ['green', 'fresh', 'retail', 'supermarket'], previewColor: '#389e0d',
    action: { type: 'pos_theme', value: 'emerald' },
  },
  {
    id: 'theme-sunset', name: 'Sunset Orange', tagline: 'Warm and energetic',
    description: 'Warm orange and amber accents with a white base. Energetic and welcoming — great for cafés, restaurants, and food service.',
    category: 'pos-themes', subcategory: 'Light', author: 'Community',
    version: '1.0.0', price: 'Free', rating: 4.3, reviews: 45, installs: 450,
    logo: '🌅', tags: ['orange', 'warm', 'cafe', 'restaurant'], previewColor: '#d46b08',
    action: { type: 'pos_theme', value: 'sunset' },
  },
  {
    id: 'theme-purple', name: 'Royal Purple', tagline: 'Premium feel for luxury retail',
    description: 'Deep purple and gold accents for a premium, upscale retail experience. Perfect for jewellery, boutiques, and high-end fashion.',
    category: 'pos-themes', subcategory: 'Dark', author: 'Nexus Design',
    version: '1.0.0', price: 'Free', rating: 4.6, reviews: 52, installs: 520,
    logo: '💜', tags: ['purple', 'luxury', 'boutique', 'premium'], previewColor: '#531dab',
    action: { type: 'pos_theme', value: 'purple' },
  },
];

export default CATALOG;

export const CATEGORY_META: Record<MarketplaceCategory, { label: string; icon: string; description: string }> = {
  'apps': { label: 'Apps', icon: '⚡', description: 'Integrations and connectors' },
  'invoice-templates': { label: 'Invoice Templates', icon: '📄', description: 'Professional invoice designs' },
  'receipt-templates': { label: 'Receipt Templates', icon: '🧾', description: 'POS receipt layouts' },
  'pos-themes': { label: 'POS Themes', icon: '🎨', description: 'Point-of-sale colour themes' },
  'widgets': { label: 'Widgets', icon: '📊', description: 'Dashboard additions (coming soon)' },
};
