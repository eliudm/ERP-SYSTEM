import React, { useState } from 'react';
import {
  Layout, Menu, Avatar, Dropdown,
  Typography, Badge, Space, Button, Popover, List, Tag, Empty,
} from 'antd';
import {
  DashboardOutlined, ShoppingCartOutlined,
  AccountBookOutlined, InboxOutlined,
  ShoppingOutlined, TeamOutlined,
  SettingOutlined, SafetyCertificateOutlined,
  LogoutOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, CheckOutlined, AppstoreOutlined,
  ContactsOutlined, LineChartOutlined, BulbOutlined,
  FundProjectionScreenOutlined, ApartmentOutlined,
  CheckSquareOutlined, NotificationOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { notificationsApi } from '../../api/notifications.api';
import type { Notification } from '../../api/notifications.api';
import dayjs from 'dayjs';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export const AppLayout: React.FC = () => {
  const { t } = useTranslation('nav');
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const isPosOnly = user?.posOnly === true;

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('dashboard'),
      posAllowed: false,
    },
    {
      key: 'pos',
      icon: <AppstoreOutlined />,
      label: t('pos.title'),
      posAllowed: true,
      children: [
        { key: '/pos/dashboard', label: t('pos.dashboard'), posAllowed: true },
        { key: '/pos/session', label: t('pos.terminal'), posAllowed: true },
        { key: '/pos/orders', label: t('pos.orders'), posAllowed: true },
        { key: '/pos/products', label: t('pos.products'), posAllowed: false },
        { key: '/pos/reporting', label: t('pos.reporting'), posAllowed: false },
        { key: '/pos/configuration', label: t('pos.configuration'), posAllowed: false },
      ],
    },
    {
      key: 'sales',
      icon: <ShoppingCartOutlined />,
      label: t('sales.title'),
      posAllowed: false,
      children: [
        { key: '/sales/quotes', label: t('sales.quotations'), posAllowed: false },
        { key: '/sales/invoices', label: t('sales.invoices'), posAllowed: false },
        { key: '/sales/customers', label: t('sales.customers'), posAllowed: false },
        { key: '/sales/credit-notes', label: t('sales.creditNotes'), posAllowed: false },
        { key: '/sales/price-lists', label: t('sales.priceLists'), posAllowed: false },
      ],
    },
    {
      key: 'accounting',
      icon: <AccountBookOutlined />,
      label: t('accounting.title'),
      posAllowed: false,
      children: [
        { key: '/accounting/accounts', label: t('accounting.chartOfAccounts'), posAllowed: false },
        { key: '/accounting/expenses', label: t('accounting.expenses'), posAllowed: false },
        { key: '/accounting/journals', label: t('accounting.journalEntries'), posAllowed: false },
        { key: '/accounting/trial-balance', label: t('accounting.trialBalance'), posAllowed: false },
        { key: '/accounting/pnl', label: t('accounting.profitLoss'), posAllowed: false },
        { key: '/accounting/balance-sheet', label: t('accounting.balanceSheet'), posAllowed: false },
        { key: '/accounting/cash-flow', label: t('accounting.cashFlow'), posAllowed: false },
        { key: '/accounting/general-ledger', label: t('accounting.generalLedger'), posAllowed: false },
        { key: '/accounting/aged-receivables', label: t('accounting.agedReceivables'), posAllowed: false },
        { key: '/accounting/aged-payables', label: t('accounting.agedPayables'), posAllowed: false },
        { key: '/accounting/payment-modes', label: t('accounting.paymentModes'), posAllowed: false },
        { key: '/accounting/bank-accounts', label: t('accounting.bankAccounts'), posAllowed: false },
        { key: '/accounting/budgets', label: t('accounting.budgets'), posAllowed: false },
        { key: '/accounting/tax-reports', label: t('accounting.taxReports'), posAllowed: false },
      ],
    },
    {
      key: 'inventory',
      icon: <InboxOutlined />,
      label: t('inventory.title'),
      posAllowed: false,
      children: [
        { key: '/inventory/products', label: t('inventory.products'), posAllowed: false },
        { key: '/inventory/warehouses', label: t('inventory.warehouses'), posAllowed: false },
        { key: '/inventory/movements', label: t('inventory.stockMovements'), posAllowed: false },
        { key: '/inventory/transfers', label: t('inventory.stockTransfers'), posAllowed: false },
        { key: '/inventory/counts', label: t('inventory.stockCounts'), posAllowed: false },
        { key: '/inventory/lots', label: t('inventory.lots'), posAllowed: false },
        { key: '/inventory/serials', label: t('inventory.serialNumbers'), posAllowed: false },
      ],
    },
    {
      key: 'procurement',
      icon: <ShoppingOutlined />,
      label: t('purchase.title'),
      posAllowed: false,
      children: [
        { key: '/procurement/rfq', label: t('purchase.orders'), posAllowed: false },
        { key: '/procurement/vendor-bills', label: t('purchase.vendorBills'), posAllowed: false },
        { key: '/procurement/suppliers', label: t('purchase.vendors'), posAllowed: false },
        { key: '/procurement/returns', label: t('purchase.purchaseReturns'), posAllowed: false },
      ],
    },
    {
      key: 'hr',
      icon: <TeamOutlined />,
      label: t('hr.title'),
      posAllowed: false,
      children: [
        { key: '/hr/employees', label: t('hr.employees'), posAllowed: false },
        { key: '/hr/payroll', label: t('hr.payroll'), posAllowed: false },
        { key: '/hr/leave', label: t('hr.leave'), posAllowed: false },
        { key: '/hr/attendance', label: t('hr.attendance'), posAllowed: false },
        { key: '/hr/recruitment', label: t('hr.recruitment'), posAllowed: false },
        { key: '/hr/appraisals', label: t('hr.appraisals'), posAllowed: false },
        { key: '/hr/allowances', label: t('hr.allowancesLoans'), posAllowed: false },
      ],
    },
    {
      key: 'etims',
      icon: <SafetyCertificateOutlined />,
      label: t('etims.title'),
      posAllowed: false,
      children: [
        { key: '/etims/config', label: t('etims.configuration'), posAllowed: false },
      ],
    },
    {
      key: '/contacts',
      icon: <ContactsOutlined />,
      label: t('contacts'),
      posAllowed: false,
    },
    {
      key: '/crm/leads',
      icon: <FundProjectionScreenOutlined />,
      label: t('crm'),
      posAllowed: false,
    },
    {
      key: 'mrp',
      icon: <ApartmentOutlined />,
      label: t('manufacturing.title'),
      posAllowed: false,
      children: [
        { key: '/mrp/bom', label: t('manufacturing.billsOfMaterials'), posAllowed: false },
        { key: '/mrp/work-orders', label: t('manufacturing.workOrders'), posAllowed: false },
      ],
    },
    {
      key: '/analytics',
      icon: <LineChartOutlined />,
      label: t('analytics'),
      posAllowed: false,
    },
    {
      key: '/ai-insights',
      icon: <BulbOutlined />,
      label: t('aiInsights'),
      posAllowed: false,
    },
    {
      key: '/workflow/approvals',
      icon: <CheckSquareOutlined />,
      label: t('approvals'),
      posAllowed: false,
    },
    {
      key: '/notifications',
      icon: <NotificationOutlined />,
      label: t('notifications'),
      posAllowed: false,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('settings'),
      posAllowed: false,
    },
  ];

  // Filter menu to only items allowed for this user's access level
  const visibleMenu = menuItems
    .filter((item) => !isPosOnly || item.posAllowed)
    .map((item) => ({
      ...item,
      children: item.children?.filter((c) => !isPosOnly || c.posAllowed),
    }));

  // Block posOnly users from navigating to non-POS routes via URL
  React.useEffect(() => {
    if (isPosOnly && !location.pathname.startsWith('/pos')) {
      navigate('/pos/session', { replace: true });
    }
  }, [isPosOnly, location.pathname, navigate]);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data: unread = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.getUnread,
    enabled: bellOpen,
    refetchInterval: bellOpen ? 30_000 : false,
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: t('topbar.profile'),
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('topbar.logout'),
        danger: true,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') logout();
      if (key === 'profile') navigate('/profile');
    },
  };

  // Get selected keys from current path
  const selectedKeys = [
    location.pathname.startsWith('/settings') ? '/settings' : location.pathname,
  ];
  const openKeys = visibleMenu
    .filter((item) =>
      item.children?.some((child) =>
        location.pathname.startsWith(child.key),
      ),
    )
    .map((item) => item.key);

  // POS session gets full-screen — no sidebar, no header
  if (location.pathname === '/pos/session') {
    return (
      <div style={{ height: '100vh', overflow: 'hidden', background: '#f4f4f4' }}>
        <Outlet />
      </div>
    );
  }

  return (
    <Layout
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f6f1ff 0%, #eef4ff 45%, #f8f5ef 100%)',
      }}
    >
      {/* ─── SIDEBAR ─────────────────────────────── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{
          background: 'rgba(255,255,255,0.66)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 20px 50px rgba(84, 73, 126, 0.12)',
          position: 'fixed',
          height: 'calc(100vh - 32px)',
          left: 16,
          top: 16,
          zIndex: 100,
          borderRadius: 28,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(122, 108, 173, 0.12)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 20px',
            borderBottom: '1px solid rgba(98, 86, 139, 0.08)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #6f67ff 0%, #1db8a0 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 700 }}>N</Text>
          </div>
          {!collapsed && (
            <Text
              style={{
                color: '#2f2749',
                fontWeight: 700,
                fontSize: 16,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {t('logoText')}
            </Text>
          )}
        </div>

        {/* Navigation Menu */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(111,103,255,0.2) transparent',
          }}
        >
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={selectedKeys}
            defaultOpenKeys={openKeys}
            items={visibleMenu}
            onClick={({ key }) => navigate(key === '/settings' ? '/settings/general' : key)}
            style={{
              borderRight: 0,
              marginTop: 8,
              background: 'transparent',
              color: '#4d4767',
            }}
          />
        </div>
      </Sider>

      {/* ─── MAIN CONTENT ────────────────────────── */}
      <Layout
        style={{
          marginLeft: collapsed ? 112 : 272,
          transition: 'margin-left 0.2s',
          background: 'transparent',
          padding: 16,
        }}
      >
        {/* Top Navbar */}
        <Header
          style={{
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(16px)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 16px 36px rgba(84, 73, 126, 0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            borderRadius: 24,
            border: '1px solid rgba(122, 108, 173, 0.12)',
          }}
        >
          <Space size="middle">
            <Button
              type="text"
              icon={
                collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18 }}
            />
            <div>
              <Text style={{ display: 'block', color: '#2f2749', fontWeight: 700 }}>
                {t('topbar.workspace')}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs().format('dddd, D MMMM YYYY')}
              </Text>
            </div>
          </Space>

          <Space size="middle">
            <Popover
              open={bellOpen}
              onOpenChange={setBellOpen}
              trigger="click"
              placement="bottomRight"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('topbar.notifications')}</span>
                  {unread.length > 0 && (
                    <Button
                      size="small"
                      type="link"
                      icon={<CheckOutlined />}
                      loading={markAllMutation.isPending}
                      onClick={() => markAllMutation.mutate()}
                    >
                      {t('topbar.markAllRead')}
                    </Button>
                  )}
                </div>
              }
              content={
                <div style={{ width: 340, maxHeight: 400, overflowY: 'auto' }}>
                  {unread.length === 0 ? (
                    <Empty description={t('topbar.noUnreadNotifications')} imageStyle={{ height: 48 }} />
                  ) : (
                    <List
                      size="small"
                      dataSource={unread}
                      renderItem={(n: Notification) => (
                        <List.Item
                          style={{ cursor: 'pointer', padding: '8px 4px' }}
                          actions={[
                            <Button
                              key="read"
                              size="small"
                              type="text"
                              icon={<CheckOutlined />}
                              onClick={(e) => { e.stopPropagation(); markOneMutation.mutate(n.id); }}
                            />,
                          ]}
                          onClick={() => {
                            markOneMutation.mutate(n.id);
                            navigate('/inventory/products');
                            setBellOpen(false);
                          }}
                        >
                          <List.Item.Meta
                            title={
                              <span style={{ fontSize: 13 }}>
                                <Tag
                                  color={n.type === 'OUT_OF_STOCK' ? 'red' : 'orange'}
                                  style={{ marginRight: 6, fontSize: 10 }}
                                >
                                  {n.type === 'OUT_OF_STOCK' ? t('topbar.outOfStock') : t('topbar.lowStock')}
                                </Tag>
                                {n.title}
                              </span>
                            }
                            description={
                              <span style={{ fontSize: 12, color: '#888' }}>
                                {n.message}<br />
                                <span style={{ fontSize: 11 }}>{dayjs(n.createdAt).format('MMM D, HH:mm')}</span>
                              </span>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              }
            >
              <Badge count={countData?.count ?? 0} overflowCount={99}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Popover>

            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ background: 'linear-gradient(135deg, #6f67ff 0%, #1db8a0 100%)' }}
                  icon={<UserOutlined />}
                />
                <Text style={{ fontWeight: 500 }}>
                  {user?.email?.split('@')[0]}
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page Content */}
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 96px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
