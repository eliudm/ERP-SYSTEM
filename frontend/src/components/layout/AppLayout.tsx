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
  ContactsOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { notificationsApi } from '../../api/notifications.api';
import type { Notification } from '../../api/notifications.api';
import dayjs from 'dayjs';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    posAllowed: false,
  },
  {
    key: 'pos',
    icon: <AppstoreOutlined />,
    label: 'Point of Sale',
    posAllowed: true,
    children: [
      { key: '/pos/dashboard', label: 'Dashboard', posAllowed: true },
      { key: '/pos/session', label: '🛒 Terminal', posAllowed: true },
      { key: '/pos/orders', label: 'Orders', posAllowed: true },
      { key: '/pos/products', label: 'Products', posAllowed: false },
      { key: '/pos/reporting', label: 'Reporting', posAllowed: false },
      { key: '/pos/configuration', label: 'Configuration', posAllowed: false },
    ],
  },
  {
    key: 'sales',
    icon: <ShoppingCartOutlined />,
    label: 'Sales',
    posAllowed: false,
    children: [
      { key: '/sales/quotes', label: 'Quotations', posAllowed: false },
      { key: '/sales/invoices', label: 'Invoices', posAllowed: false },
      { key: '/sales/customers', label: 'Customers', posAllowed: false },
      { key: '/sales/credit-notes', label: 'Credit Notes', posAllowed: false },
      { key: '/sales/price-lists', label: 'Price Lists', posAllowed: false },
    ],
  },
  {
    key: 'accounting',
    icon: <AccountBookOutlined />,
    label: 'Accounting',
    posAllowed: false,
    children: [
      { key: '/accounting/accounts', label: 'Chart of Accounts', posAllowed: false },
      { key: '/accounting/journals', label: 'Journal Entries', posAllowed: false },
      { key: '/accounting/trial-balance', label: 'Trial Balance', posAllowed: false },
      { key: '/accounting/pnl', label: 'Profit & Loss', posAllowed: false },
      { key: '/accounting/bank-accounts', label: 'Bank Accounts', posAllowed: false },
    ],
  },
  {
    key: 'inventory',
    icon: <InboxOutlined />,
    label: 'Inventory',
    posAllowed: false,
    children: [
      { key: '/inventory/products', label: 'Products', posAllowed: false },
      { key: '/inventory/warehouses', label: 'Warehouses', posAllowed: false },
      { key: '/inventory/movements', label: 'Stock Movements', posAllowed: false },
      { key: '/inventory/transfers', label: 'Stock Transfers', posAllowed: false },
      { key: '/inventory/counts', label: 'Stock Counts', posAllowed: false },
      { key: '/inventory/lots', label: 'Lots', posAllowed: false },
      { key: '/inventory/serials', label: 'Serial Numbers', posAllowed: false },
    ],
  },
  {
    key: 'procurement',
    icon: <ShoppingOutlined />,
    label: 'Purchase',
    posAllowed: false,
    children: [
      { key: '/procurement/rfq', label: 'Orders', posAllowed: false },
      { key: '/procurement/vendor-bills', label: 'Vendor Bills', posAllowed: false },
      { key: '/procurement/suppliers', label: 'Vendors', posAllowed: false },
      { key: '/procurement/returns', label: 'Purchase Returns', posAllowed: false },
    ],
  },
  {
    key: 'hr',
    icon: <TeamOutlined />,
    label: 'HR & Payroll',
    posAllowed: false,
    children: [
      { key: '/hr/employees', label: 'Employees', posAllowed: false },
      { key: '/hr/payroll', label: 'Payroll', posAllowed: false },
      { key: '/hr/leave', label: 'Leave', posAllowed: false },
      { key: '/hr/attendance', label: 'Attendance', posAllowed: false },
      { key: '/hr/recruitment', label: 'Recruitment', posAllowed: false },
      { key: '/hr/appraisals', label: 'Appraisals', posAllowed: false },
      { key: '/hr/allowances', label: 'Allowances & Loans', posAllowed: false },
    ],
  },
  {
    key: 'etims',
    icon: <SafetyCertificateOutlined />,
    label: 'eTIMS',
    posAllowed: false,
    children: [
      { key: '/etims/config', label: 'Configuration', posAllowed: false },
    ],
  },
  {
    key: '/contacts',
    icon: <ContactsOutlined />,
    label: 'Contacts',
    posAllowed: false,
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: 'Settings',
    posAllowed: false,
  },
];

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const isPosOnly = user?.posOnly === true;

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
        label: 'Profile',
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
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
              Nexora ERP
            </Text>
          )}
        </div>

        {/* Navigation Menu */}
        <div
          style={{
            flex: 1,
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
                Nexora Workspace
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
                  <span>Notifications</span>
                  {unread.length > 0 && (
                    <Button
                      size="small"
                      type="link"
                      icon={<CheckOutlined />}
                      loading={markAllMutation.isPending}
                      onClick={() => markAllMutation.mutate()}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
              }
              content={
                <div style={{ width: 340, maxHeight: 400, overflowY: 'auto' }}>
                  {unread.length === 0 ? (
                    <Empty description="No unread notifications" imageStyle={{ height: 48 }} />
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
                                  {n.type === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock'}
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
