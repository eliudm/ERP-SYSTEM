import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button, Input, Typography,
  Space, Table, Divider, Select, message,
  InputNumber, Empty, Tag, Modal, Alert, Dropdown, Switch, Form, Spin,
} from 'antd';
import {
  DeleteOutlined,
  ShoppingCartOutlined, WarningOutlined,
  ArrowLeftOutlined, MenuOutlined, MonitorOutlined,
  SwapOutlined, ReloadOutlined, CloseCircleOutlined, LinkOutlined,
  BulbOutlined, DownloadOutlined, LockOutlined,
  FileTextOutlined, PlusOutlined, UserOutlined, UpOutlined, DownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '../../../api/client';
import { inventoryApi } from '../../../api/inventory.api';
import { salesApi } from '../../../api/sales.api';
import { settingsApi } from '../../../api/settings.api';
import { authApi } from '../../../api/auth.api';
import { formatCurrency } from '../../../utils/format';
import type { Customer, Product, ProductCategory, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '../../../types';

const { Title, Text } = Typography;
const { Search } = Input;

interface CartItem {
  productId: string;
  name: string;
  code: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface ReceiptData {
  receiptNo: string;
  invoiceId?: string;
  invoiceNo?: string;
  qrCode?: string;
  etimsInvoiceNo?: string;
  provisionalQr?: boolean;
  qrStatus?: string;
  qrMessage?: string;
  createdAt: string;
  customerName: string;
  customerPin: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  servedBy: string;
  items: CartItem[];
}

interface PendingMpesaTransaction {
  id: string;
  status: 'PENDING' | 'FAILED';
  phoneNumber: string;
  amount: number;
  checkoutRequestId?: string;
  receiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  createdAt: string;
  updatedAt: string;
  invoice: {
    id: string;
    invoiceNo: string;
    status: string;
    total: number;
    customerName: string;
  };
}

interface PendingMpesaPanelRow extends PendingMpesaTransaction {
  isResolving?: boolean;
}

export const POSPage: React.FC = () => {
  const WALK_IN_VALUE = '__walk_in__';
  const defaultBusinessInfo = {
    name: 'Nexora ERP',
    pin: 'P051234567X',
    address: 'Moi Avenue, Nairobi, Kenya',
    slogan: 'Streamlined operations. Compliant receipts. Better business.',
  };

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>();
  const [warehouseId, setWarehouseId] = useState<string>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null);
  const [validatedReceipt, setValidatedReceipt] = useState<ReceiptData | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashDirection, setCashDirection] = useState<'in' | 'out'>('in');
  const [cashForm] = Form.useForm();
  const [closeRegisterOpen, setCloseRegisterOpen] = useState(false);
  const [closingCounts, setClosingCounts] = useState<Record<string, number>>({});
  const [closingNote, setClosingNote] = useState('');
  const [locked, setLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockForm] = Form.useForm();
  const [numpadMode, setNumpadMode] = useState<'qty' | 'disc' | 'price'>('qty');
  const [numpadBuffer, setNumpadBuffer] = useState('');
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedPendingTx, setSelectedPendingTx] = useState<PendingMpesaTransaction | null>(null);
  const [reconcileReceiptNumber, setReconcileReceiptNumber] = useState('');
  const [reconcilePhoneNumber, setReconcilePhoneNumber] = useState('');
  const [reconcileAmount, setReconcileAmount] = useState<number | undefined>(undefined);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [mpesaStatusFilter, setMpesaStatusFilter] = useState<'ALL' | 'PENDING' | 'FAILED'>('ALL');
  const [panelTransactions, setPanelTransactions] = useState<PendingMpesaPanelRow[]>([]);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [createCustomerForm] = Form.useForm();
  const [isCompactCalculator, setIsCompactCalculator] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth <= 1366 || window.innerHeight <= 860;
  });
  const [showCalculator, setShowCalculator] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return !(window.innerWidth <= 1366 || window.innerHeight <= 860);
  });
  const resolvingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const previousActiveTxIdsRef = useRef<string[]>([]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_MS = 5 * 60 * 1000; // 5 minutes
  const navigate = useNavigate();
  const posVerified = useAuthStore((s) => s.posVerified);
  const setPosVerified = useAuthStore((s) => s.setPosVerified);
  const setPosLastClosedDate = useAuthStore((s) => s.setPosLastClosedDate);
  const currentUser = useAuthStore((s) => s.user);
  const servedByName = currentUser?.firstName || currentUser?.email || 'Unknown';
  const queryClient = useQueryClient();

  // ── Idle timeout ─────────────────────────────────────────
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setLocked(true), IDLE_MS);
  }, [IDLE_MS]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle(); // start on mount
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  const handleUnlock = async () => {
    try {
      const values = await lockForm.validateFields();
      if (!currentUser?.email) return;
      setLockLoading(true);
      await authApi.login(currentUser.email, values.password);
      lockForm.resetFields();
      setLocked(false);
      resetIdle();
    } catch (err: unknown) {
      const isAxiosError = (e: unknown): e is { response?: { status?: number } } =>
        typeof e === 'object' && e !== null && 'response' in e;
      if (isAxiosError(err) && err.response?.status === 401) {
        message.error('Incorrect password');
      }
    } finally {
      setLockLoading(false);
    }
  };

  const { data: products } = useQuery({
    queryKey: ['products', search, categoryId],
    queryFn: () => inventoryApi.getProducts(search, categoryId),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => salesApi.getCustomers(),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: inventoryApi.getCategories,
  });

  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ['low-stock'],
    queryFn: inventoryApi.getLowStock,
    refetchInterval: 60000,
  });

  const {
    data: pendingMpesaTransactions,
    isFetching: pendingMpesaFetching,
    refetch: refetchPendingMpesaTransactions,
  } = useQuery({
    queryKey: ['mpesa-pending-transactions'],
    queryFn: () => salesApi.getPendingMpesaTransactions(),
    refetchInterval: 7000,
  });

  useEffect(() => {
    const latest = pendingMpesaTransactions || [];
    const latestIds = new Set(latest.map((tx) => tx.id));
    const removedIds = previousActiveTxIdsRef.current.filter((id) => !latestIds.has(id));

    // If a previously removed id comes back (for example after retry), cancel fade-out removal.
    latest.forEach((tx) => {
      const timer = resolvingTimersRef.current[tx.id];
      if (timer) {
        clearTimeout(timer);
        delete resolvingTimersRef.current[tx.id];
      }
    });

    setPanelTransactions((prev) => {
      const previousMap = new Map(prev.map((row) => [row.id, row]));
      const baseRows: PendingMpesaPanelRow[] = latest.map((tx) => ({
        ...tx,
        isResolving: false,
      }));

      const resolvingRows: PendingMpesaPanelRow[] = removedIds
        .map((id) => previousMap.get(id))
        .filter((row): row is PendingMpesaPanelRow => Boolean(row))
        .map((row) => ({ ...row, isResolving: true }));

      return [...baseRows, ...resolvingRows];
    });

    removedIds.forEach((id) => {
      const oldTimer = resolvingTimersRef.current[id];
      if (oldTimer) {
        clearTimeout(oldTimer);
      }

      resolvingTimersRef.current[id] = setTimeout(() => {
        setPanelTransactions((prev) => prev.filter((row) => row.id !== id));
        delete resolvingTimersRef.current[id];
      }, 500);
    });

    previousActiveTxIdsRef.current = latest.map((tx) => tx.id);
  }, [pendingMpesaTransactions]);

  useEffect(() => {
    const timers = resolvingTimersRef.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth <= 1366 || window.innerHeight <= 860;
      setIsCompactCalculator(compact);

      // Keep products/cart visible on tight screens by default.
      if (compact) {
        setShowCalculator(false);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredPanelTransactions = panelTransactions.filter((tx) => {
    if (mpesaStatusFilter === 'ALL') {
      return true;
    }

    return tx.status === mpesaStatusFilter;
  });

  const mpesaFilterCounts = (pendingMpesaTransactions || []).reduce(
    (acc, tx) => {
      if (tx.status === 'PENDING') {
        acc.pending += 1;
      }

      if (tx.status === 'FAILED') {
        acc.failed += 1;
      }

      return acc;
    },
    { pending: 0, failed: 0 },
  );
  const totalMpesaQueueCount =
    mpesaFilterCounts.pending + mpesaFilterCounts.failed;

  const today = new Date().toISOString().split('T')[0];
  const { data: dailySummary, isLoading: dailySummaryLoading } = useQuery({
    queryKey: ['daily-summary', today],
    queryFn: () => salesApi.getDailySummary(today),
    enabled: closeRegisterOpen,
  });

  const BUSINESS_INFO = {
    name: systemSettings?.companyName || defaultBusinessInfo.name,
    logo: systemSettings?.companyLogo || null,
    pin: systemSettings?.companyPin || defaultBusinessInfo.pin,
    address: systemSettings?.companyAddress || defaultBusinessInfo.address,
    slogan: systemSettings?.receiptSlogan || defaultBusinessInfo.slogan,
  };
  const showReceiptBranding = systemSettings?.posReceiptBranding ?? true;
  const defaultWarehouseId = (warehouses || [])[0]?.id as string | undefined;
  const activeWarehouseId = warehouseId || defaultWarehouseId;

  const selectedCustomerName = customerId === WALK_IN_VALUE
    ? 'Walk-in Customer'
    : (customers || []).find((customer: Customer) => customer.id === customerId)?.name || 'N/A';

  const selectedCustomer = customerId === WALK_IN_VALUE
    ? null
    : (customers || []).find((customer: Customer) => customer.id === customerId);

  const customerPin = selectedCustomer?.taxPin || 'N/A';
  const receiptNo = `POS-${new Date().getTime()}`;

  const sleep = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

  const isValidKenyaPhone = (value: string) => /^(254|0)\d{9}$/.test(value.trim());

  const waitForMpesaSettlement = async (invoiceId: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(3000);
      const status = await salesApi.getMpesaPaymentStatus(invoiceId);

      if (status.invoice.status === 'PAID') {
        return status;
      }

      if (status.mpesa?.status === 'FAILED') {
        throw new Error(status.mpesa.resultDesc || 'M-Pesa payment failed');
      }
    }

    throw new Error('M-Pesa confirmation is still pending. Please check payment status shortly.');
  };

  const fetchEtimsQrCode = async (invoiceId: string) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const res = await apiClient.get(`/etims/invoice/${invoiceId}/qr`);
        return res.data as {
          qrCode?: string;
          etimsInvoiceNo?: string;
          provisional?: boolean;
          status?: string;
          message?: string;
        };
      } catch {
        if (attempt < 5) {
          await sleep(1000);
        }
      }
    }

    return null;
  };

  const createInvoiceMutation = useMutation({
    mutationFn: salesApi.createInvoice,
    onSuccess: async (invoice) => {
      if (paymentMethod === 'MOBILE_MONEY') {
        await salesApi.approveInvoice(invoice.id, activeWarehouseId);
        await salesApi.initiateMpesaPayment(invoice.id, {
          phoneNumber: mpesaPhoneNumber.trim(),
          accountReference: invoice.invoiceNo,
          description: `POS payment for ${invoice.invoiceNo}`,
        });

        message.loading({
          key: 'mpesa-payment',
          content: 'M-Pesa prompt sent. Waiting for payment confirmation...',
          duration: 0,
        });

        await waitForMpesaSettlement(invoice.id);
        message.success({
          key: 'mpesa-payment',
          content: 'M-Pesa payment confirmed',
          duration: 2,
        });
      } else {
        await salesApi.approveInvoice(invoice.id, activeWarehouseId, paymentMethod);
      }

      const qrDetails = await fetchEtimsQrCode(invoice.id);
      if (qrDetails?.provisional) {
        message.warning(qrDetails.message || 'eTIMS QR unavailable. Showing provisional receipt QR.');
      } else {
        message.success(`Sale completed - Invoice ${invoice.invoiceNo}`);
      }
      if (pendingReceipt) {
        setValidatedReceipt({
          ...pendingReceipt,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          qrCode: qrDetails?.qrCode,
          etimsInvoiceNo: qrDetails?.etimsInvoiceNo,
          provisionalQr: qrDetails?.provisional,
          qrStatus: qrDetails?.status,
          qrMessage: qrDetails?.message,
        });
      }
      setPaymentOpen(false);
      setCart([]);
      setCustomerId(undefined);
      setWarehouseId(undefined);
      setPaymentMethod('CASH');
      setMpesaPhoneNumber('');
      setPendingReceipt(null);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.destroy('mpesa-payment');
      message.error(apiError.response?.data?.message || 'Sale failed');
      setPendingReceipt(null);
    },
  });

  const retryMpesaMutation = useMutation({
    mutationFn: (transactionId: string) => salesApi.retryMpesaTransaction(transactionId),
    onSuccess: () => {
      message.success('M-Pesa retry request sent');
      queryClient.invalidateQueries({ queryKey: ['mpesa-pending-transactions'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Retry failed');
    },
  });

  const reconcileMpesaMutation = useMutation({
    mutationFn: (payload: {
      transactionId: string;
      receiptNumber: string;
      phoneNumber?: string;
      amount?: number;
      notes?: string;
    }) => salesApi.reconcileMpesaTransaction(payload.transactionId, {
      receiptNumber: payload.receiptNumber,
      phoneNumber: payload.phoneNumber,
      amount: payload.amount,
      notes: payload.notes,
    }),
    onSuccess: () => {
      message.success('Transaction reconciled and invoice updated');
      setReconcileModalOpen(false);
      setSelectedPendingTx(null);
      setReconcileReceiptNumber('');
      setReconcilePhoneNumber('');
      setReconcileAmount(undefined);
      setReconcileNotes('');
      queryClient.invalidateQueries({ queryKey: ['mpesa-pending-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Reconciliation failed');
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string; email?: string; taxPin?: string }) =>
      salesApi.createCustomer(data),
    onSuccess: (newCustomer) => {
      message.success(`Customer "${newCustomer.name}" created`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCustomerId(newCustomer.id);
      createCustomerForm.resetFields();
      setCreateCustomerOpen(false);
    },
    onError: (error: unknown) => {
      const apiError = error as AxiosError<{ message?: string }>;
      message.error(apiError.response?.data?.message || 'Failed to create customer');
    },
  });

  const addToCart = (product: Product) => {
    const existing = cart.find((i) => i.productId === product.id);
    if (existing) {
      setCart(cart.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1 }
          : i,
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        code: product.code,
        unitPrice: Number(product.unitPrice),
        taxRate: Number(product.taxRate),
        quantity: 1,
      }]);
    }
    setSelectedCartId(product.id);
    setNumpadBuffer('');
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map((i) =>
      i.productId === productId ? { ...i, quantity: qty } : i,
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((i) => i.productId !== productId));
  };

  const subtotal = cart.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity, 0,
  );
  const taxTotal = cart.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity * i.taxRate, 0,
  );
  const total = subtotal + taxTotal;

  const openPayment = () => {
    if (!customerId) {
      message.warning('Please select a customer');
      return;
    }
    if (cart.length === 0) {
      message.warning('Cart is empty');
      return;
    }
    if (!activeWarehouseId) {
      message.warning('Please select a warehouse');
      return;
    }
    const selected = (customers || []).find((customer: Customer) => customer.id === customerId);
    setMpesaPhoneNumber(selected?.phone || '');
    setCashTendered('');
    setPaymentOpen(true);
  };

  const applyNumpadBuffer = (productId: string, buffer: string) => {
    const value = parseFloat(buffer);
    if (isNaN(value)) return;
    if (numpadMode === 'qty') {
      if (value > 0) updateQty(productId, value);
    } else if (numpadMode === 'price') {
      if (value >= 0) setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, unitPrice: value } : i));
    }
  };

  const handleNumpadKey = (key: string) => {
    const targetId = selectedCartId || (cart.length > 0 ? cart[cart.length - 1].productId : null);
    if (!targetId) return;
    if (key === '⌫') {
      const nb = numpadBuffer.slice(0, -1);
      setNumpadBuffer(nb);
      if (nb && nb !== '-') applyNumpadBuffer(targetId, nb);
      return;
    }
    if (key === '+/-') {
      const nb = numpadBuffer.startsWith('-') ? numpadBuffer.slice(1) : '-' + numpadBuffer;
      setNumpadBuffer(nb);
      return;
    }
    if (key === '.' && numpadBuffer.includes('.')) return;
    const nb = numpadBuffer + key;
    setNumpadBuffer(nb);
    applyNumpadBuffer(targetId, nb);
  };

  const resolveCustomerId = async (): Promise<string> => {
    if (!customerId) {
      throw new Error('Customer is required');
    }

    if (customerId !== WALK_IN_VALUE) {
      return customerId;
    }

    const existingWalkIn = (customers || []).find(
      (customer: Customer) => String(customer.name || '').trim().toLowerCase() === 'walk-in customer'
        || String(customer.name || '').trim().toLowerCase() === 'walk in customer'
        || String(customer.name || '').trim().toLowerCase() === 'walk in',
    );

    if (existingWalkIn?.id) {
      return existingWalkIn.id;
    }

    const created = await salesApi.createCustomer({
      name: 'Walk-in Customer',
    });
    return created.id;
  };

  const confirmSale = async () => {
    try {
      const resolvedCustomerId = await resolveCustomerId();

      setPendingReceipt({
        receiptNo,
        createdAt: new Date().toISOString(),
        customerName: selectedCustomerName,
        customerPin,
        subtotal,
        taxTotal,
        total,
        paymentMethod,
        servedBy: servedByName,
        items: [...cart],
      });

      createInvoiceMutation.mutate({
        customerId: resolvedCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0],
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
        })),
      });
    } catch (error: unknown) {
	  const apiError = error as Error;
	  message.error(apiError.message || 'Unable to complete sale');
    }
  };

  const openReconcileModal = (tx: PendingMpesaTransaction) => {
    setSelectedPendingTx(tx);
    setReconcileReceiptNumber(tx.receiptNumber || '');
    setReconcilePhoneNumber(tx.phoneNumber || '');
    setReconcileAmount(tx.amount);
    setReconcileNotes(tx.resultDesc || '');
    setReconcileModalOpen(true);
  };

  const submitReconciliation = () => {
    if (!selectedPendingTx) {
      return;
    }

    if (!reconcileReceiptNumber.trim()) {
      message.warning('Receipt number is required for reconciliation');
      return;
    }

    reconcileMpesaMutation.mutate({
      transactionId: selectedPendingTx.id,
      receiptNumber: reconcileReceiptNumber.trim(),
      phoneNumber: reconcilePhoneNumber.trim() || undefined,
      amount: reconcileAmount,
      notes: reconcileNotes.trim() || undefined,
    });
  };

  const printReceipt = (receipt: ReceiptData) => {
    const now = new Date(receipt.createdAt);
    const printWindow = window.open('', '_blank', 'width=360,height=720');

    if (!printWindow) {
      message.error('Unable to open print window. Please allow pop-ups.');
      return;
    }

    const rows = receipt.items.map((item) => `
      <tr>
        <td style="padding:4px 0; width:18px; vertical-align:top; font-weight:600;">${item.quantity}</td>
        <td style="padding:4px 0; vertical-align:top;">
          <div>${item.name}</div>
          <div style="font-size:10px; color:#888;">${formatCurrency(item.unitPrice)} / Unit</div>
        </td>
        <td style="text-align:right; padding:4px 0; vertical-align:top; white-space:nowrap;">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>
    `).join('');

    const qrSection = receipt.qrCode
      ? `<div style="text-align:center; margin-top:10px;"><img src="${receipt.qrCode}" alt="${receipt.provisionalQr ? 'Receipt QR Code' : 'eTIMS QR Code'}" style="width:120px; height:120px;" /><div style="font-size:11px; margin-top:4px;">${receipt.provisionalQr ? 'Provisional Receipt QR' : 'eTIMS QR Code'}</div>${receipt.qrMessage ? `<div style="font-size:10px; margin-top:4px; color:#666;">${receipt.qrMessage}</div>` : ''}</div>`
      : `<div style="text-align:center; margin-top:10px; font-size:11px; color:#666;">eTIMS QR code pending</div>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>POS Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; padding: 0; color: #111; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .totals { margin-top: 8px; font-size: 12px; }
            .line { display: flex; justify-content: space-between; margin: 3px 0; }
            .grand { font-weight: 700; font-size: 14px; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 4px 0; margin: 4px 0; }
            .footer-biz { text-align:center; font-size:11px; margin-top:10px; padding-top:8px; border-top:1px dashed #ccc; }
          </style>
        </head>
        <body>
          <!-- Logo + Business Identity -->
          <div style="text-align:center; margin-bottom:0;">
            ${BUSINESS_INFO.logo
              ? `<img src="${BUSINESS_INFO.logo}" alt="${BUSINESS_INFO.name}" style="max-height:80px; max-width:200px; object-fit:contain;" />`
              : `<div style="font-size:16px; font-weight:700;">${BUSINESS_INFO.name}</div>`
            }
            ${showReceiptBranding ? `
            <div style="font-size:11px; margin-top:4px;">
              ${BUSINESS_INFO.logo ? `<div style="font-weight:700;">${BUSINESS_INFO.name}</div>` : ''}
              ${BUSINESS_INFO.address ? `<div>${BUSINESS_INFO.address}</div>` : ''}
              ${BUSINESS_INFO.pin ? `<div>PIN: ${BUSINESS_INFO.pin}</div>` : ''}
            </div>` : ''}
          </div>

          <!-- Ticket header (centered) -->
          <div style="text-align:center; font-size:11px; border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:6px 0; margin:8px 0;">
            <div>Receipt: ${receipt.receiptNo}</div>
            <div>${now.toLocaleString()}</div>
            <div>Served by: ${receipt.servedBy}</div>
            ${receipt.customerName && receipt.customerName !== 'Walk-in Customer' ? `<div>Customer: ${receipt.customerName}</div>` : ''}
            ${receipt.customerPin && receipt.customerPin !== 'N/A' ? `<div>PIN: ${receipt.customerPin}</div>` : ''}
          </div>

          <!-- Items -->
          <table>
            <tbody>${rows}</tbody>
          </table>

          <!-- Totals -->
          <div class="totals" style="border-top:1px dashed #999; padding-top:6px;">
            <div class="line"><span>Subtotal</span><span>${formatCurrency(receipt.subtotal)}</span></div>
            <div class="line"><span>VAT 16%</span><span>${formatCurrency(receipt.taxTotal)}</span></div>
            <div class="line grand"><span>Total</span><span>${formatCurrency(receipt.total)}</span></div>
            <div class="line"><span>${PAYMENT_METHOD_LABELS[receipt.paymentMethod]}</span><span>${formatCurrency(receipt.total)}</span></div>
          </div>

          <!-- QR Code -->
          ${qrSection}

          <!-- Slogan / payment instructions -->
          ${BUSINESS_INFO.slogan ? `<div style="text-align:center; font-size:11px; margin-top:10px; padding-top:8px; border-top:1px dashed #eee;">${BUSINESS_INFO.slogan}</div>` : ''}

          <!-- Powered by -->
          <div style="text-align:center; margin-top:10px; font-size:10px; color:#aaa; border-top:1px dashed #eee; padding-top:6px;">Powered by: Nexora ERP</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!posVerified) {
    navigate('/pos/dashboard', { replace: true });
    return null;
  }

  return (
    <>
    {/* ── Lock screen overlay ───────────────────────────── */}
    {locked && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #2d1a45 0%, #4a2560 60%, #1a0f2e 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }}>
        {/* Company logo / name */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            border: '3px solid rgba(255,255,255,0.25)',
          }}>
            <ShoppingCartOutlined style={{ fontSize: 44, color: '#fff' }} />
          </div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
            {BUSINESS_INFO.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 6 }}>
            Session locked after 5 minutes of inactivity
          </div>
        </div>

        {/* Unlock card */}
        <div style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 16, padding: '32px 40px',
          width: 340, backdropFilter: 'blur(10px)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 20, textAlign: 'center', fontSize: 14 }}>
            <LockOutlined style={{ marginRight: 6 }} />
            Signed in as <strong style={{ color: '#fff' }}>{currentUser?.firstName || currentUser?.email}</strong>
          </div>
          <Form form={lockForm} onFinish={handleUnlock}>
            <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]} style={{ marginBottom: 16 }}>
              <Input.Password
                prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
                placeholder="Enter password to unlock"
                size="large"
                autoFocus
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={lockLoading}
              style={{ background: '#fff', color: '#4a2560', borderColor: '#fff', fontWeight: 700 }}
            >
              Unlock Terminal
            </Button>
          </Form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              type="link"
              style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}
              onClick={() => { setPosVerified(false); navigate('/pos/dashboard'); }}
            >
              Exit to Dashboard
            </Button>
          </div>
        </div>

        {/* Clock */}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    )}

    {/* ─── Main POS Layout ─────────────────────────────────── */}
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f4f4', filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none', transition: 'filter 0.3s' }}>

      {/* Top toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 12px', height: 50, gap: 8, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" type="text" onClick={() => { setPosVerified(false); navigate('/pos/dashboard'); }} title="Dashboard" />
        <div style={{ display: 'flex' }}>
          <Button type="primary" size="small" style={{ borderRadius: '4px 0 0 4px', background: '#4a2560', borderColor: '#4a2560', fontWeight: 600 }}>Register</Button>
          <Button size="small" style={{ borderRadius: '0 4px 4px 0' }} onClick={() => navigate('/pos/orders')}>Orders</Button>
        </div>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { setCart([]); setCustomerId(undefined); setSelectedCartId(null); setNumpadBuffer(''); }}>New</Button>
        {cart.length > 0 && (
          <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
            {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''} — {formatCurrency(total)}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <Search
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
          size="small"
        />
        <Switch size="small" checked={darkMode} onChange={setDarkMode} checkedChildren={<BulbOutlined />} unCheckedChildren={<BulbOutlined />} title="Dark mode" />
        <Dropdown
          trigger={['click']}
          dropdownRender={() => (
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.15)', minWidth: 220, padding: '8px 0' }}>
              <div style={{ textAlign: 'center', padding: '10px 0 6px', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                <MonitorOutlined style={{ fontSize: 28, color: '#555' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer' }} onClick={() => setDarkMode((d) => !d)}>
                <Space><BulbOutlined />Dark Mode</Space>
                <Switch size="small" checked={darkMode} onChange={setDarkMode} onClick={(_, e) => e.stopPropagation()} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer' }} onClick={() => { setCashDirection('in'); cashForm.resetFields(); setCashModalOpen(true); }}>
                <SwapOutlined />Cash In/Out
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer' }} onClick={() => { queryClient.invalidateQueries(); message.success('Data reloaded'); }}>
                <ReloadOutlined />Reload Data
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer' }} onClick={() => window.open('http://localhost:3000/api', '_blank')}>
                <LinkOutlined />Backend
              </div>
              <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 4 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', color: '#ff4d4f' }} onClick={() => setCloseRegisterOpen(true)}>
                <CloseCircleOutlined />Close Register
              </div>
            </div>
          )}
        >
          <Button icon={<MenuOutlined />} size="small" />
        </Dropdown>
      </div>

      {/* Body: left (cart) + right (products) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── RIGHT PANEL: Categories + Products ───────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', order: 2 }}>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fff', borderBottom: '1px solid #e0e0e0', overflowX: 'auto', flexShrink: 0, flexWrap: 'wrap', maxHeight: 110 }}>
            <button
              onClick={() => setCategoryId(undefined)}
              style={{ padding: '6px 16px', borderRadius: 6, border: '2px solid ' + (!categoryId ? '#4a2560' : '#e0e0e0'), background: !categoryId ? '#4a2560' : '#fff', color: !categoryId ? '#fff' : '#444', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              All
            </button>
            {(categories || []).map((cat: ProductCategory) => {
              const isActive = categoryId === cat.id;
              const color = cat.color || '#1677ff';
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(isActive ? undefined : cat.id)}
                  style={{ padding: '6px 16px', borderRadius: 6, border: '2px solid ' + (isActive ? color : '#e0e0e0'), background: isActive ? color : '#fff', color: isActive ? '#fff' : color, fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                >
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </button>
              );
            })}
          </div>

          {/* Low stock alert */}
          {lowStockProducts && lowStockProducts.length > 0 && (
            <Alert
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              message={
                <span>
                  <strong>{lowStockProducts.length} item{lowStockProducts.length > 1 ? 's' : ''} low on stock:</strong>{' '}
                  {lowStockProducts.slice(0, 4).map((p: any) => (
                    <Tag key={p.id} color="orange" style={{ marginRight: 4 }}>{p.name} ({p.stockQuantity})</Tag>
                  ))}
                  {lowStockProducts.length > 4 && <Tag>+{lowStockProducts.length - 4} more</Tag>}
                </span>
              }
              style={{ margin: 0, borderRadius: 0 }}
            />
          )}

          {/* Product grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {(products || []).length === 0 ? (
              <Empty description="No products found" style={{ marginTop: 60 }} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {(products || []).map((product: Product) => {
                  const inCart = cart.find((i) => i.productId === product.id);
                  const inStock = Number(product.stockQuantity) > 0;
                  const catColor = product.category?.color || '#8c8c8c';
                  return (
                    <div
                      key={product.id}
                      onClick={() => inStock && addToCart(product)}
                      style={{
                        cursor: inStock ? 'pointer' : 'not-allowed',
                        opacity: inStock ? 1 : 0.45,
                        border: inCart ? '2px solid #1677ff' : '1px solid #e0e0e0',
                        borderRadius: 8,
                        background: '#fff',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: inCart ? '0 2px 8px rgba(22,119,255,0.18)' : '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'box-shadow 0.15s, border 0.15s',
                      }}
                    >
                      <div style={{ height: 72, background: catColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <span style={{ fontSize: 30, color: 'rgba(255,255,255,0.7)', fontWeight: 800, userSelect: 'none' }}>
                          {product.name.charAt(0).toUpperCase()}
                        </span>
                        {inCart && (
                          <div style={{ position: 'absolute', top: 6, right: 6, background: '#1677ff', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                            {inCart.quantity}
                          </div>
                        )}
                        {!inStock && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>
                            OUT OF STOCK
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '6px 8px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 700 }}>
                          {formatCurrency(Number(product.unitPrice))}
                        </div>
                        {inStock && (
                          <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 1 }}>Stock: {Number(product.stockQuantity)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>{/* end right panel */}

        {/* ── LEFT PANEL: Cart + Numpad ──────────────────── */}
        <div style={{ width: isCompactCalculator ? 320 : 380, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #e0e0e0', order: 1 }}>

          {/* Warehouse selector */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
            <Select
              size="small"
              placeholder="Warehouse..."
              style={{ width: '100%' }}
              value={activeWarehouseId}
              onChange={setWarehouseId}
              options={(warehouses || []).map((wh: WarehouseOption) => ({ value: wh.id, label: wh.name }))}
            />
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
                <ShoppingCartOutlined style={{ fontSize: 40 }} />
                <div style={{ marginTop: 10, fontSize: 13 }}>Click products to add them</div>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={item.productId}
                  onClick={() => { setSelectedCartId(item.productId); setNumpadBuffer(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '8px 10px', cursor: 'pointer',
                    background: selectedCartId === item.productId ? '#e6f4ff' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                    borderLeft: selectedCartId === item.productId ? '3px solid #1677ff' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{formatCurrency(item.unitPrice)} / unit</div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 8, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(item.unitPrice * item.quantity)}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>x {item.quantity}</div>
                  </div>
                  <Button
                    type="text" danger size="small" icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.productId); if (selectedCartId === item.productId) setSelectedCartId(null); }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          {cart.length > 0 && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid #f0f0f0', background: '#fafafa', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginBottom: 2 }}>
                <span>Taxes (16%)</span>
                <span style={{ color: '#52c41a' }}>{formatCurrency(taxTotal)} ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {/* Customer + Note */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid #f0f0f0' }}>
            <Select
              placeholder={<span><UserOutlined style={{ marginRight: 4 }} />Customer</span>}
              style={{ flex: 1 }}
              size="middle"
              showSearch
              allowClear
              value={customerId}
              onChange={setCustomerId}
              filterOption={(i, o) => String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              options={[
                { value: WALK_IN_VALUE, label: 'Walk-in Customer' },
                ...((customers || []).map((c: Customer) => ({ value: c.id, label: c.name }))),
              ]}
            />
            <Button
              size="middle"
              icon={<PlusOutlined />}
              title="New customer"
              onClick={() => setCreateCustomerOpen(true)}
            />
            <Button size="middle" icon={<FileTextOutlined />} title="Note" />
          </div>

          {/* Numpad */}
          <div style={{ padding: isCompactCalculator ? '6px 8px' : '8px 10px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCalculator ? (isCompactCalculator ? 6 : 8) : 0 }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Calculator</div>
              <Button
                size="small"
                type="text"
                icon={showCalculator ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setShowCalculator((prev) => !prev)}
              >
                {showCalculator ? 'Hide' : 'Show'}
              </Button>
            </div>

            {showCalculator && (
              <>
                <div style={{ textAlign: 'right', padding: isCompactCalculator ? '3px 8px' : '4px 10px', minHeight: isCompactCalculator ? 28 : 32, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, marginBottom: isCompactCalculator ? 6 : 8, fontFamily: 'monospace', fontSize: isCompactCalculator ? 14 : 16, color: numpadBuffer ? '#262626' : '#bbb' }}>
                  {numpadBuffer || (selectedCartId
                    ? (numpadMode === 'qty'
                      ? String(cart.find(i => i.productId === selectedCartId)?.quantity ?? '')
                      : String(cart.find(i => i.productId === selectedCartId)?.unitPrice ?? ''))
                    : 'select an item'
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isCompactCalculator ? 3 : 4 }}>
                  {(['1','2','3','Qty','4','5','6','%','7','8','9','Price','+/-','0','.','⌫'] as const).map((key) => {
                    const isModeKey = key === 'Qty' || key === '%' || key === 'Price';
                    const modeMap: Record<string, 'qty' | 'disc' | 'price'> = { 'Qty': 'qty', '%': 'disc', 'Price': 'price' };
                    const isActiveModeKey = isModeKey && numpadMode === modeMap[key];
                    const getBg = () => {
                      if (isActiveModeKey) return '#c8ecf0';
                      if (key === '+/-') return '#fde68a';
                      if (key === '.') return '#fdd5d0';
                      if (key === '⌫') return '#f4aaaa';
                      return '#fff';
                    };
                    const getBorder = () => {
                      if (isActiveModeKey) return '2px solid #2fb3c8';
                      return '1px solid #e0e0e0';
                    };
                    return (
                      <button
                        key={key}
                        onClick={() => { if (isModeKey) { setNumpadMode(modeMap[key]); setNumpadBuffer(''); } else handleNumpadKey(key); }}
                        style={{
                          height: isCompactCalculator ? 40 : 48, border: getBorder(), borderRadius: 4,
                          background: getBg(),
                          color: key === '⌫' ? '#8b1a1a' : '#262626',
                          fontWeight: isModeKey ? 600 : 400,
                          fontSize: isCompactCalculator
                            ? (isModeKey ? 12 : 14)
                            : (isModeKey ? 13 : 16),
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* M-Pesa pending transactions */}
          {totalMpesaQueueCount === 0 ? (
            <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', background: '#fffdf7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }}>
              <div style={{ fontSize: 11, color: '#7a7a7a' }}>
                M-Pesa queue: <strong>0 pending</strong>
              </div>
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => refetchPendingMpesaTransactions()}
                loading={pendingMpesaFetching}
                style={{ height: 22, paddingInline: 6 }}
              >
                Refresh
              </Button>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', background: '#fffdf7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6f4e00' }}>
                  M-Pesa Pending Transactions
                </div>
                <Space size={6}>
                  <Select
                    size="small"
                    value={mpesaStatusFilter}
                    onChange={(value) => setMpesaStatusFilter(value)}
                    style={{ width: 105 }}
                    options={[
                      {
                        value: 'ALL',
                        label: `All (${totalMpesaQueueCount})`,
                      },
                      {
                        value: 'PENDING',
                        label: `Pending (${mpesaFilterCounts.pending})`,
                      },
                      {
                        value: 'FAILED',
                        label: `Failed (${mpesaFilterCounts.failed})`,
                      },
                    ]}
                  />
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => refetchPendingMpesaTransactions()}
                    loading={pendingMpesaFetching}
                  >
                    Refresh
                  </Button>
                  {pendingMpesaFetching && <Spin size="small" />}
                </Space>
              </div>

              {filteredPanelTransactions.length === 0 ? (
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>No transactions for selected filter</div>
              ) : (
                <div style={{ maxHeight: isCompactCalculator ? 110 : 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredPanelTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        border: '1px solid #f0e1b0',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '6px 8px',
                        opacity: tx.isResolving ? 0 : 1,
                        transform: tx.isResolving ? 'translateX(8px)' : 'translateX(0)',
                        transition: 'opacity 0.45s ease, transform 0.45s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <strong>{tx.invoice.invoiceNo}</strong>
                        <Tag color={tx.status === 'PENDING' ? 'gold' : 'red'} style={{ marginRight: 0 }}>
                          {tx.status}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>
                        {tx.invoice.customerName} | {formatCurrency(tx.amount)} | {tx.phoneNumber}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="small"
                          onClick={() => retryMpesaMutation.mutate(tx.id)}
                          loading={retryMpesaMutation.isPending}
                        >
                          Retry
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => openReconcileModal(tx)}
                        >
                          Reconcile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment button */}
          <div style={{ padding: 10, borderTop: '1px solid #e0e0e0' }}>
            <button
              onClick={openPayment}
              disabled={cart.length === 0}
              style={{
                width: '100%', height: 52, fontSize: 17, fontWeight: 700,
                background: cart.length === 0 ? '#d9d9d9' : '#4a2560',
                color: cart.length === 0 ? '#aaa' : '#fff',
                border: 'none', borderRadius: 6,
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {cart.length > 0 ? `Payment   ${formatCurrency(total)}` : 'Payment'}
            </button>
          </div>

        </div>{/* end left panel */}

      </div>{/* end body */}
    </div>{/* end outer layout */}

    {/* ── Payment Modal ─────────────────────────────────── */}
    <Modal
      title={<span style={{ fontWeight: 700, fontSize: 16 }}>Payment — {formatCurrency(total)}</span>}
      open={paymentOpen}
      onCancel={() => setPaymentOpen(false)}
      footer={null}
      width={480}
      destroyOnClose
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Select Payment Method</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT'] as PaymentMethod[]).map((m) => (
            <Button
              key={m}
              type={paymentMethod === m ? 'primary' : 'default'}
              size="large"
              style={{ flex: '1 1 120px', height: 48, fontWeight: 600 }}
              onClick={() => setPaymentMethod(m)}
            >
              {PAYMENT_METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
            </Button>
          ))}
        </div>
      </div>
      {paymentMethod === 'CASH' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Cash Tendered</div>
          <InputNumber
            style={{ width: '100%' }} size="large" min={0} precision={2}
            value={cashTendered ? parseFloat(cashTendered) : undefined}
            onChange={(v) => setCashTendered(v != null ? String(v) : '')}
            placeholder={`Min: ${formatCurrency(total)}`}
            autoFocus
          />
          {cashTendered !== '' && parseFloat(cashTendered) >= total && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, fontWeight: 600 }}>
              Change: {formatCurrency(parseFloat(cashTendered) - total)}
            </div>
          )}
          {cashTendered !== '' && parseFloat(cashTendered) < total && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 6, color: '#cf1322' }}>
              Short: {formatCurrency(total - parseFloat(cashTendered))}
            </div>
          )}
        </div>
      )}
      {paymentMethod === 'MOBILE_MONEY' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>M-Pesa Phone Number</div>
          <Input
            size="large"
            placeholder="e.g. 2547XXXXXXXX"
            value={mpesaPhoneNumber}
            onChange={(event) => setMpesaPhoneNumber(event.target.value)}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            Customer will receive an STK push prompt on this number.
          </div>
          {mpesaPhoneNumber.trim() !== '' && !isValidKenyaPhone(mpesaPhoneNumber) && (
            <div style={{ marginTop: 8, color: '#cf1322', fontSize: 12 }}>
              Enter a valid Kenyan phone number: 07XXXXXXXX or 2547XXXXXXXX.
            </div>
          )}
        </div>
      )}
      <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: '#888' }}>
          <span>Customer</span><span style={{ color: '#262626', fontWeight: 500 }}>{selectedCustomerName}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: '#888' }}>
          <span>Items</span><span style={{ color: '#262626' }}>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: '#888' }}>
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#888' }}>
          <span>VAT 16%</span><span>{formatCurrency(taxTotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, borderTop: '1px solid #e8e8e8', paddingTop: 6 }}>
          <span>Total</span><span style={{ color: '#1677ff' }}>{formatCurrency(total)}</span>
        </div>
      </div>
      <Button
        type="primary" block size="large"
        style={{ height: 54, fontSize: 16, fontWeight: 700, background: '#52c41a', borderColor: '#52c41a' }}
        loading={createInvoiceMutation.isPending}
        onClick={confirmSale}
        disabled={
          (paymentMethod === 'CASH' && cashTendered !== '' && parseFloat(cashTendered) < total)
          || (paymentMethod === 'MOBILE_MONEY' && !isValidKenyaPhone(mpesaPhoneNumber))
        }
      >
        Validate Payment
      </Button>
    </Modal>

    <Modal
      title="Reconcile M-Pesa Transaction"
      open={reconcileModalOpen}
      onCancel={() => setReconcileModalOpen(false)}
      onOk={submitReconciliation}
      okText="Reconcile"
      confirmLoading={reconcileMpesaMutation.isPending}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {selectedPendingTx
            ? `${selectedPendingTx.invoice.invoiceNo} - ${selectedPendingTx.invoice.customerName}`
            : 'Select transaction'}
        </Text>

        <div>
          <Text style={{ fontSize: 12 }}>M-Pesa Receipt Number</Text>
          <Input
            value={reconcileReceiptNumber}
            onChange={(event) => setReconcileReceiptNumber(event.target.value)}
            placeholder="e.g. QGH7X9LMN2"
          />
        </div>

        <div>
          <Text style={{ fontSize: 12 }}>Phone Number</Text>
          <Input
            value={reconcilePhoneNumber}
            onChange={(event) => setReconcilePhoneNumber(event.target.value)}
            placeholder="2547XXXXXXXX"
          />
        </div>

        <div>
          <Text style={{ fontSize: 12 }}>Amount</Text>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            precision={2}
            value={reconcileAmount}
            onChange={(value) => setReconcileAmount(value != null ? Number(value) : undefined)}
          />
        </div>

        <div>
          <Text style={{ fontSize: 12 }}>Notes</Text>
          <Input.TextArea
            rows={3}
            value={reconcileNotes}
            onChange={(event) => setReconcileNotes(event.target.value)}
            placeholder="Optional reconciliation notes"
          />
        </div>
      </Space>
    </Modal>

      <Modal
        title="Sale Validated"
        open={!!validatedReceipt}
        onCancel={() => setValidatedReceipt(null)}
        footer={[
          <Button key="close" onClick={() => setValidatedReceipt(null)}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            onClick={() => validatedReceipt && printReceipt(validatedReceipt)}
          >
            Print Receipt
          </Button>,
        ]}
        width={420}
      >
        {validatedReceipt && (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                background: '#fff',
                width: 320,
                margin: '0 auto',
                fontSize: 12,
              }}
            >
              {/* Logo + Business Identity */}
              <div style={{ textAlign: 'center', marginBottom: 4 }}>
                {BUSINESS_INFO.logo ? (
                  <img src={BUSINESS_INFO.logo} alt={BUSINESS_INFO.name} style={{ maxHeight: 60, maxWidth: 160, objectFit: 'contain', marginBottom: 4 }} />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{BUSINESS_INFO.name}</div>
                )}
                {showReceiptBranding && (
                  <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>
                    {BUSINESS_INFO.logo && <div style={{ fontWeight: 700 }}>{BUSINESS_INFO.name}</div>}
                    {BUSINESS_INFO.address && <div>{BUSINESS_INFO.address}</div>}
                    {BUSINESS_INFO.pin && <div>PIN: {BUSINESS_INFO.pin}</div>}
                  </div>
                )}
              </div>
              {/* Ticket header */}
              <div style={{ textAlign: 'center', fontSize: 11, color: '#555', borderTop: '1px dashed #ddd', borderBottom: '1px dashed #ddd', padding: '6px 0', marginBottom: 10 }}>
                <div>Receipt: {validatedReceipt.receiptNo}</div>
                <div>{new Date(validatedReceipt.createdAt).toLocaleString()}</div>
                <div>Served by: {validatedReceipt.servedBy}</div>
                {validatedReceipt.customerName && validatedReceipt.customerName !== 'Walk-in Customer' && (
                  <div>Customer: {validatedReceipt.customerName}</div>
                )}
                {validatedReceipt.customerPin && validatedReceipt.customerPin !== 'N/A' && (
                  <div>PIN: {validatedReceipt.customerPin}</div>
                )}
              </div>

              <Divider style={{ margin: '8px 0' }} />
              <Table
                dataSource={validatedReceipt.items}
                rowKey="productId"
                pagination={false}
                size="small"
                showHeader={false}
                columns={[
                  {
                    title: 'Qty',
                    key: 'qty',
                    width: 28,
                    render: (_: unknown, r: CartItem) => <strong>{r.quantity}</strong>,
                  },
                  {
                    title: 'Item',
                    key: 'item',
                    render: (_: unknown, r: CartItem) => (
                      <div>
                        <div>{r.name}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{formatCurrency(r.unitPrice)} / Unit</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Amount',
                    key: 'amount',
                    align: 'right' as const,
                    render: (_: unknown, r: CartItem) => formatCurrency(r.unitPrice * r.quantity),
                  },
                ]}
              />

              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Subtotal</Text>
                <Text>{formatCurrency(validatedReceipt.subtotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">VAT 16%</Text>
                <Text>{formatCurrency(validatedReceipt.taxTotal)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '4px 0', margin: '4px 0' }}>
                <Text strong style={{ fontSize: 14 }}>Total</Text>
                <Text strong style={{ fontSize: 14 }}>{formatCurrency(validatedReceipt.total)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{PAYMENT_METHOD_ICONS[validatedReceipt.paymentMethod]} {PAYMENT_METHOD_LABELS[validatedReceipt.paymentMethod]}</Text>
                <Text>{formatCurrency(validatedReceipt.total)}</Text>
              </div>

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                {validatedReceipt.qrCode ? (
                  <>
                    <img
                      src={validatedReceipt.qrCode}
                      alt={validatedReceipt.provisionalQr ? 'Receipt QR Code' : 'eTIMS QR Code'}
                      style={{ width: 120, height: 120 }}
                    />
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {validatedReceipt.provisionalQr ? 'Provisional Receipt QR' : 'eTIMS QR Code'}
                      </Text>
                    </div>
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>eTIMS QR code pending</Text>
                )}
              </div>
              {validatedReceipt.qrMessage && (
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {validatedReceipt.qrMessage}
                  </Text>
                </div>
              )}
              {showReceiptBranding && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text italic style={{ fontSize: 11 }}>{BUSINESS_INFO.slogan}</Text>
                </div>
              )}
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: '#aaa', borderTop: '1px dashed #eee', paddingTop: 6 }}>
                Powered by: Nexora ERP
              </div>
            </div>
          </Space>
        )}
      </Modal>

      {/* ── Close Register modal ─────────────────────────── */}
      <Modal
        open={closeRegisterOpen}
        onCancel={() => setCloseRegisterOpen(false)}
        width={640}
        destroyOnClose
        footer={null}
        title={null}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0 }}>Closing Register</Title>
          {dailySummary && (
            <Text strong style={{ fontSize: 15 }}>
              {dailySummary.totalOrders} order{dailySummary.totalOrders !== 1 ? 's' : ''}: {formatCurrency(dailySummary.totalRevenue)}
            </Text>
          )}
        </div>

        {dailySummaryLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : (
          <>
            {/* Payment method breakdown */}
            {(dailySummary?.byPaymentMethod ?? []).map((row) => {
              const counted = closingCounts[row.method] ?? 0;
              const diff = counted - row.amount;
              return (
                <div key={row.method} style={{ marginBottom: 20, borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 15 }}>
                      {PAYMENT_METHOD_ICONS[row.method as PaymentMethod]} {PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method}
                    </Text>
                    <Text strong style={{ fontSize: 15 }}>{formatCurrency(counted)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 13, marginLeft: 16 }}>
                    <span>▸ Payments</span>
                    <span>+ {formatCurrency(row.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: diff === 0 ? '#888' : '#ff4d4f', fontSize: 13, marginLeft: 16 }}>
                    <span>Difference</span>
                    <span>{formatCurrency(diff)}</span>
                  </div>
                </div>
              );
            })}

            {(!dailySummary || dailySummary.byPaymentMethod.length === 0) && (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>No sales today</div>
            )}

            <Divider />

            {/* Counted amounts inputs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
              {(dailySummary?.byPaymentMethod ?? []).map((row) => (
                <div key={row.method} style={{ flex: '1 1 180px' }}>
                  <div style={{ marginBottom: 4, fontSize: 13 }}>
                    {PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method} Count
                  </div>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={2}
                    value={closingCounts[row.method] ?? 0}
                    onChange={(v) => setClosingCounts((prev) => ({ ...prev, [row.method]: v ?? 0 }))}
                  />
                </div>
              ))}
            </div>

            {/* Closing note */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 4, fontSize: 13 }}>Closing note</div>
              <Input.TextArea
                rows={3}
                placeholder="Add a closing note..."
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
              />
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Space>
                <Button
                  type="primary"
                  style={{ background: '#4a2560', borderColor: '#4a2560', fontWeight: 600 }}
                  onClick={() => {
                    const closeDate = new Date().toISOString().split('T')[0];
                    message.success('Register closed');
                    setCloseRegisterOpen(false);
                    setClosingNote('');
                    setClosingCounts({});
                    setPosLastClosedDate(closeDate);
                    setPosVerified(false);
                    navigate('/pos/dashboard');
                  }}
                >
                  Close Register
                </Button>
                <Button onClick={() => { setCloseRegisterOpen(false); setClosingNote(''); setClosingCounts({}); }}>
                  Discard
                </Button>
              </Space>
              <Space>
                <Button
                  icon={<SwapOutlined />}
                  onClick={() => { setCloseRegisterOpen(false); setCashDirection('in'); cashForm.resetFields(); setCashModalOpen(true); }}
                >
                  Cash In/Out
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    if (!dailySummary) return;
                    const rows = (dailySummary.byPaymentMethod).map((r) =>
                      `${PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}\t${formatCurrency(r.amount)}\t${r.orders} orders`
                    ).join('\n');
                    const content = `Daily Sale Report — ${today}\n\nTotal Orders: ${dailySummary.totalOrders}\nTotal Revenue: ${formatCurrency(dailySummary.totalRevenue)}\n\n${rows}\n\nClosing Note: ${closingNote || 'N/A'}`;
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `daily-sale-${today}.txt`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Daily Sale
                </Button>
              </Space>
            </div>
          </>
        )}
      </Modal>

      {/* Cash In / Out modal */}
      <Modal
        open={cashModalOpen}
        title={
          <Space>
            <SwapOutlined />
            Cash In / Out
          </Space>
        }
        onCancel={() => setCashModalOpen(false)}
        onOk={async () => {
          try {
            const values = await cashForm.validateFields();
            const label = cashDirection === 'in' ? 'Cash In' : 'Cash Out';
            message.success(`${label}: KES ${Number(values.amount).toLocaleString()} recorded — ${values.reason || 'No reason given'}`);
            setCashModalOpen(false);
            cashForm.resetFields();
          } catch { /* validation */ }
        }}
        okText={cashDirection === 'in' ? 'Record Cash In' : 'Record Cash Out'}
        width={400}
        destroyOnClose
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={cashDirection === 'in' ? 'primary' : 'default'}
              block
              onClick={() => setCashDirection('in')}
              style={cashDirection === 'in' ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
            >
              Cash In
            </Button>
            <Button
              type={cashDirection === 'out' ? 'primary' : 'default'}
              block
              onClick={() => setCashDirection('out')}
              danger={cashDirection === 'out'}
            >
              Cash Out
            </Button>
          </div>
          <Form form={cashForm} layout="vertical">
            <Form.Item
              name="amount"
              label="Amount (KES)"
              rules={[{ required: true, message: 'Enter an amount' }, { type: 'number', min: 1, transform: Number, message: 'Must be greater than 0' }]}
            >
              <InputNumber style={{ width: '100%' }} min={1} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="reason" label="Reason / Note">
              <Input placeholder="e.g. Opening float, petty cash..." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title="New Customer"
        open={createCustomerOpen}
        onCancel={() => { createCustomerForm.resetFields(); setCreateCustomerOpen(false); }}
        onOk={() => createCustomerForm.submit()}
        okText="Create"
        confirmLoading={createCustomerMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createCustomerForm}
          layout="vertical"
          onFinish={(values) => createCustomerMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Customer name is required' }]}
          >
            <Input placeholder="e.g. Jane Mwangi" autoFocus />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="e.g. 0712345678" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="e.g. jane@example.com" />
          </Form.Item>
          <Form.Item name="taxPin" label="Tax PIN (KRA)">
            <Input placeholder="e.g. A012345678Z" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
