import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Chip,
  Button,
  IconButton,
  Portal,
  Modal,
  RadioButton,
  TextInput,
  Snackbar,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { mobileApi, PosProduct } from '../../api/mobile.api';
import { customersApi, Customer } from '../../api/customers.api';
import { salesApi } from '../../api/sales.api';
import { etimsApi, EtimsQrResult } from '../../api/etims.api';
import { inventoryApi } from '../../api/inventory.api';
import { settingsApi } from '../../api/settings.api';
import { useSession } from '../../providers/SessionProvider';
import { Numpad, NumpadMode } from '../../components/Numpad';
import { Receipt, ReceiptData } from '../../components/Receipt';
import { useRegister } from '../../hooks/useRegister';
import { brand } from '../../theme';

interface CartLine {
  productId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

const TILE_COLORS = ['#1db8a0', '#6f67ff', '#f08c2f', '#2f80ed', '#e05297'];
const colorForProduct = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1)
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isValidKenyaPhone = (value: string) =>
  /^(254|0)\d{9}$/.test(value.trim());

export default function PosScreen() {
  const queryClient = useQueryClient();
  const { width, height } = useWindowDimensions();
  const dockExpandedMaxHeight = Math.min(560, height * 0.72);
  const { user } = useSession();

  const numColumns = width < 420 ? 2 : width < 700 ? 3 : width < 1000 ? 4 : 5;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pos-data'],
    queryFn: () => mobileApi.getPosData(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const register = useRegister();
  const [registerModal, setRegisterModal] = useState<'open' | 'close' | null>(
    null,
  );
  const [openingFloatInput, setOpeningFloatInput] = useState('');
  const [cashCountedInput, setCashCountedInput] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const { data: dailySummary, isLoading: dailySummaryLoading } = useQuery({
    queryKey: ['daily-summary', today],
    queryFn: () => salesApi.getDailySummary(today),
    enabled: registerModal === 'close',
  });

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [numpadBuffer, setNumpadBuffer] = useState('');
  const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');

  const [chargeVisible, setChargeVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [checkoutStage, setCheckoutStage] = useState<string | null>(null);

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptQr, setReceiptQr] = useState<EtimsQrResult | null>(null);
  const [receiptQrLoading, setReceiptQrLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    isError?: boolean;
  }>({
    visible: false,
    message: '',
  });

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const paymentMethods = data?.paymentMethods ?? [];
  const activeWarehouseId = warehouseId ?? warehouses[0]?.id;

  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((l) => map.set(l.productId, l.quantity));
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryId]);

  const itemCount = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity, 0),
    [cart],
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  );
  const taxTotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity * line.taxRate,
        0,
      ),
    [cart],
  );
  const total = subtotal + taxTotal;

  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          basePrice: product.unitPrice,
          unitPrice: product.unitPrice,
          taxRate: product.taxRate,
          quantity: 1,
        },
      ];
    });
    setCartExpanded(true);
    setSelectedLineId(product.id);
    setNumpadBuffer('');
    setNumpadMode('qty');
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeLine(productId);
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity: qty } : l,
      ),
    );
  };

  const incrementLine = (productId: string, delta: number) => {
    const line = cart.find((l) => l.productId === productId);
    if (!line) return;
    updateQty(productId, line.quantity + delta);
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
    if (selectedLineId === productId) setSelectedLineId(null);
  };

  const updatePrice = (productId: string, unitPrice: number) => {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)),
    );
  };

  const updateDiscountPercent = (productId: string, percent: number) => {
    const clamped = Math.min(100, Math.max(0, percent));
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? { ...l, unitPrice: l.basePrice * (1 - clamped / 100) }
          : l,
      ),
    );
  };

  const applyNumpadBuffer = (productId: string, buffer: string) => {
    const value = parseFloat(buffer);
    if (isNaN(value)) return;
    if (numpadMode === 'qty') {
      if (value > 0) updateQty(productId, value);
    } else if (numpadMode === 'discount') {
      if (value >= 0) updateDiscountPercent(productId, value);
    } else if (value >= 0) {
      updatePrice(productId, value);
    }
  };

  const handleNumpadKey = (key: string) => {
    const targetId =
      selectedLineId ||
      (cart.length > 0 ? cart[cart.length - 1].productId : null);
    if (!targetId) return;
    if (key === '+/-') return; // neither qty nor price are ever negative here
    if (key === '.' && numpadBuffer.includes('.')) return;
    const nb = numpadBuffer + key;
    setNumpadBuffer(nb);
    applyNumpadBuffer(targetId, nb);
  };

  const handleNumpadBackspace = () => {
    const targetId =
      selectedLineId ||
      (cart.length > 0 ? cart[cart.length - 1].productId : null);
    if (!targetId) return;
    const nb = numpadBuffer.slice(0, -1);
    setNumpadBuffer(nb);
    if (nb) applyNumpadBuffer(targetId, nb);
  };

  const selectLine = (productId: string) => {
    setSelectedLineId((current) => (current === productId ? null : productId));
    setNumpadBuffer('');
    setNumpadMode('qty');
  };

  const resetChargeModal = () => {
    setPaymentMethod('CASH');
    setCustomerQuery('');
    setCustomerResults([]);
    setSelectedCustomer(null);
    setMpesaPhone('');
    setCheckoutStage(null);
  };

  const openChargeModal = () => {
    resetChargeModal();
    setChargeVisible(true);
  };

  const closeChargeModal = () => {
    if (chargeMutation.isPending) return;
    setChargeVisible(false);
  };

  const runCustomerSearch = async (q: string) => {
    setCustomerQuery(q);
    setSelectedCustomer(null);
    const query = q.trim();
    if (!query) {
      setCustomerResults([]);
      return;
    }
    setSearchingCustomers(true);
    try {
      const results = await customersApi.getCustomers(query);
      setCustomerResults(results);
    } catch {
      setCustomerResults([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setMpesaPhone(customer.phone ?? '');
  };

  const resolveWalkInCustomer = async (): Promise<Customer> => {
    const matches = await customersApi.getCustomers(WALK_IN_CUSTOMER_NAME);
    const existing = matches.find((c) => c.name === WALK_IN_CUSTOMER_NAME);
    if (existing) return existing;
    return customersApi.createCustomer({ name: WALK_IN_CUSTOMER_NAME });
  };

  const waitForMpesaSettlement = async (invoiceId: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(3000);
      const status = await salesApi.getMpesaStatus(invoiceId);
      if (status.invoice.status === 'PAID') return;
      if (status.mpesa?.status === 'FAILED') {
        throw new Error(status.mpesa.resultDesc || 'M-Pesa payment failed');
      }
    }
    throw new Error(
      'M-Pesa confirmation is still pending. Check payment status shortly.',
    );
  };

  const fetchEtimsQrWithRetry = async (
    invoiceId: string,
  ): Promise<EtimsQrResult | null> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        return await etimsApi.getQRCode(invoiceId);
      } catch {
        if (attempt < 5) await sleep(1000);
      }
    }
    return null;
  };

  const chargeMutation = useMutation({
    mutationFn: async () => {
      if (paymentMethod === 'MOBILE_MONEY' && !isValidKenyaPhone(mpesaPhone)) {
        throw new Error('Enter a valid M-Pesa number, e.g. 2547XXXXXXXX');
      }

      const customer = selectedCustomer ?? (await resolveWalkInCustomer());

      setCheckoutStage('Creating invoice…');
      const invoice = await salesApi.createInvoice({
        customerId: customer.id,
        invoiceDate: new Date().toISOString(),
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
        })),
      });

      setCheckoutStage('Approving and updating stock…');
      await salesApi.approveInvoice(invoice.id, {
        warehouseId: activeWarehouseId,
        paymentMethod,
      });

      if (paymentMethod === 'MOBILE_MONEY') {
        setCheckoutStage('Sending M-Pesa prompt…');
        await salesApi.initiateMpesaStkPush(invoice.id, {
          phoneNumber: mpesaPhone.trim(),
          accountReference: invoice.invoiceNo,
          description: `POS payment for ${invoice.invoiceNo}`,
        });
        setCheckoutStage('Waiting for M-Pesa confirmation…');
        await waitForMpesaSettlement(invoice.id);
      }

      return {
        invoice,
        receipt: {
          invoiceNo: invoice.invoiceNo,
          createdAt: new Date().toISOString(),
          customerName: customer.name,
          servedBy: user?.email ?? 'Staff',
          subtotal,
          taxTotal,
          total,
          paymentMethod,
          items: cart.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        } satisfies ReceiptData,
      };
    },
    onSuccess: ({ invoice, receipt }) => {
      setChargeVisible(false);
      setCart([]);
      setCartExpanded(false);
      setSelectedLineId(null);
      setCheckoutStage(null);
      setReceiptData(receipt);
      setReceiptQr(null);
      setReceiptQrLoading(true);
      void queryClient.invalidateQueries({ queryKey: ['mobile-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['pos-data'] });
      void fetchEtimsQrWithRetry(invoice.id).then((qr) => {
        setReceiptQr(qr);
        setReceiptQrLoading(false);
      });
    },
    onError: (err: any) => {
      setCheckoutStage(null);
      const message =
        err?.message ??
        err?.response?.data?.message ??
        'Failed to complete sale. Please try again.';
      setSnackbar({
        visible: true,
        message: Array.isArray(message) ? message.join(', ') : message,
        isError: true,
      });
    },
  });

  const closeReceipt = () => {
    setReceiptData(null);
    setReceiptQr(null);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {(error as any)?.response?.data?.message ??
            'Failed to load POS data.'}
        </Text>
        <Button
          mode="contained"
          onPress={() => void refetch()}
          style={{ marginTop: 12 }}
        >
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search name, code, or barcode"
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={styles.searchbarInput}
      />

      {!register.isLoading && (
        <Pressable
          style={[
            styles.registerBanner,
            register.isOpen
              ? styles.registerBannerOpen
              : styles.registerBannerClosed,
          ]}
          onPress={() => {
            setOpeningFloatInput('');
            setCashCountedInput('');
            setRegisterModal(register.isOpen ? 'close' : 'open');
          }}
        >
          <MaterialCommunityIcons
            name={register.isOpen ? 'cash-register' : 'lock-outline'}
            size={16}
            color={register.isOpen ? brand.gradientEnd : '#ad7a14'}
          />
          <Text
            style={[
              styles.registerBannerText,
              { color: register.isOpen ? brand.gradientEnd : '#ad7a14' },
            ]}
          >
            {register.isOpen
              ? `Register open since ${new Date(register.openedAt!).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} · Tap to close`
              : 'Register closed · Tap to open'}
          </Text>
        </Pressable>
      )}

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          <Chip
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
            style={styles.chip}
            mode={categoryId === null ? 'flat' : 'outlined'}
            textStyle={
              categoryId === null ? styles.chipTextSelected : undefined
            }
            compact
          >
            All
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              selected={categoryId === cat.id}
              onPress={() => setCategoryId(cat.id)}
              style={styles.chip}
              mode={categoryId === cat.id ? 'flat' : 'outlined'}
              textStyle={
                categoryId === cat.id ? styles.chipTextSelected : undefined
              }
              compact
            >
              {cat.name}
            </Chip>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={numColumns}
        style={styles.grid}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: cartExpanded && cart.length > 0 ? 340 : 96 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.errorText}>No products match your search.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const qty = cartQuantities.get(item.id) ?? 0;
          const outOfStock = item.stockQuantity <= 0;
          return (
            <Pressable
              style={styles.productTile}
              onPress={() => addToCart(item)}
            >
              <View
                style={[
                  styles.productAvatar,
                  { backgroundColor: colorForProduct(item.id) },
                ]}
              >
                <Text style={styles.productAvatarLetter}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
                {qty > 0 && (
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>{qty}</Text>
                  </View>
                )}
                {outOfStock && (
                  <View style={styles.stockRibbon}>
                    <Text style={styles.stockRibbonText}>Out of stock</Text>
                  </View>
                )}
                {!outOfStock && item.stockQuantity <= 5 && (
                  <View style={styles.lowStockDot} />
                )}
              </View>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.productCode} numberOfLines={1}>
                {item.code}
              </Text>
              <Text style={styles.productPrice}>
                {formatCurrency(item.unitPrice)}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* ── Cart dock: slim summary bar, expands on tap ── */}
      {cart.length > 0 && (
        <View
          style={[
            styles.cartDock,
            cartExpanded && { maxHeight: dockExpandedMaxHeight },
          ]}
        >
          <Pressable
            style={styles.cartSummaryBar}
            onPress={() => setCartExpanded((e) => !e)}
          >
            <View style={styles.cartSummaryLeft}>
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountBadgeText}>{itemCount}</Text>
              </View>
              <Text style={styles.cartSummaryLabel}>
                {cartExpanded ? 'Hide cart' : 'View cart'}
              </Text>
            </View>
            <View style={styles.cartSummaryRight}>
              <Text style={styles.cartSummaryTotal}>
                {formatCurrency(total)}
              </Text>
              <IconButton
                icon={cartExpanded ? 'chevron-down' : 'chevron-up'}
                size={20}
                onPress={() => setCartExpanded((e) => !e)}
              />
            </View>
          </Pressable>

          {cartExpanded && (
            <>
              <ScrollView
                style={styles.cartScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {cart.map((line) => {
                  const isSelected = selectedLineId === line.productId;
                  const discountPercent =
                    line.basePrice > 0
                      ? Math.round((1 - line.unitPrice / line.basePrice) * 100)
                      : 0;
                  const hasDiscount = discountPercent > 0;
                  return (
                    <View key={line.productId}>
                      <Pressable
                        style={[
                          styles.cartLine,
                          isSelected && styles.cartLineSelected,
                        ]}
                        onPress={() => selectLine(line.productId)}
                      >
                        <View style={styles.cartLineInfo}>
                          <Text style={styles.cartLineName} numberOfLines={1}>
                            {line.name}
                          </Text>
                          <Text style={styles.cartLinePrice}>
                            {hasDiscount && (
                              <Text style={styles.cartLineStrike}>
                                {formatCurrency(line.basePrice)}{' '}
                              </Text>
                            )}
                            {formatCurrency(line.unitPrice)} x {line.quantity}
                            {hasDiscount && (
                              <Text style={styles.cartLineDiscountTag}>
                                {'  '}-{discountPercent}%
                              </Text>
                            )}
                            {'  '}
                            <Text style={styles.cartLineTotal}>
                              = {formatCurrency(line.unitPrice * line.quantity)}
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.cartLineControls}>
                          <IconButton
                            icon="minus"
                            size={16}
                            mode="outlined"
                            onPress={() => incrementLine(line.productId, -1)}
                          />
                          <Text style={styles.qtyText}>{line.quantity}</Text>
                          <IconButton
                            icon="plus"
                            size={16}
                            mode="outlined"
                            onPress={() => incrementLine(line.productId, 1)}
                          />
                          <IconButton
                            icon="trash-can-outline"
                            size={16}
                            iconColor={brand.gradientStart}
                            onPress={() => removeLine(line.productId)}
                          />
                        </View>
                      </Pressable>

                      {isSelected && (
                        <View style={styles.numpadSection}>
                          <Text style={styles.numpadHint}>
                            {numpadMode === 'qty' &&
                              `Quantity: ${line.quantity}`}
                            {numpadMode === 'discount' &&
                              `Discount: ${discountPercent}%`}
                            {numpadMode === 'price' &&
                              `Unit price: ${formatCurrency(line.unitPrice)}`}
                            {numpadBuffer ? ` → ${numpadBuffer}` : ''}
                          </Text>
                          <Numpad
                            mode={numpadMode}
                            onModeChange={(m) => {
                              setNumpadMode(m);
                              setNumpadBuffer('');
                            }}
                            onKeyPress={handleNumpadKey}
                            onBackspace={handleNumpadBackspace}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <Divider style={styles.divider} />

              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(subtotal)}
                </Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(taxTotal)}
                </Text>
              </View>
            </>
          )}

          <Button
            mode="contained"
            style={styles.chargeButton}
            contentStyle={styles.chargeButtonContent}
            disabled={cart.length === 0}
            onPress={openChargeModal}
          >
            {cartExpanded
              ? `Charge ${formatCurrency(total)}`
              : `Charge · ${formatCurrency(total)}`}
          </Button>
        </View>
      )}

      <Portal>
        <Modal
          visible={chargeVisible}
          onDismiss={closeChargeModal}
          dismissable={!chargeMutation.isPending}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Checkout</Text>
            <Text style={styles.modalTotal}>{formatCurrency(total)}</Text>

            <Text style={styles.modalSectionLabel}>Customer</Text>
            <TextInput
              mode="outlined"
              placeholder="Search customer, or leave blank for Walk-in Customer"
              value={customerQuery}
              onChangeText={runCustomerSearch}
              dense
              style={styles.customerInput}
            />
            {searchingCustomers && (
              <ActivityIndicator size="small" style={{ marginVertical: 4 }} />
            )}
            {!searchingCustomers && customerQuery.trim().length > 0 && (
              <ScrollView style={styles.customerResults}>
                {customerResults.length === 0 ? (
                  <Text style={styles.noCustomerText}>
                    No matches. Clear search to use Walk-in Customer, or try
                    another name.
                  </Text>
                ) : (
                  customerResults.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.customerRow,
                        selectedCustomer?.id === c.id &&
                          styles.customerRowSelected,
                      ]}
                      onPress={() => selectCustomer(c)}
                    >
                      <Text style={styles.customerRowText}>{c.name}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}
            <Text style={styles.selectedCustomerHint}>
              {selectedCustomer
                ? `Selected: ${selectedCustomer.name}`
                : `Will use: ${WALK_IN_CUSTOMER_NAME}`}
            </Text>

            {warehouses.length > 1 && (
              <>
                <Text style={styles.modalSectionLabel}>Warehouse</Text>
                <SegmentedButtons
                  value={activeWarehouseId ?? ''}
                  onValueChange={setWarehouseId}
                  buttons={warehouses.map((w) => ({
                    value: w.id,
                    label: w.name,
                  }))}
                  style={styles.warehouseButtons}
                />
              </>
            )}

            <Text style={styles.modalSectionLabel}>Payment method</Text>
            <RadioButton.Group
              onValueChange={setPaymentMethod}
              value={paymentMethod}
            >
              {paymentMethods.map((method) => (
                <RadioButton.Item
                  key={method}
                  label={PAYMENT_METHOD_LABELS[method] ?? method}
                  value={method}
                />
              ))}
            </RadioButton.Group>

            {paymentMethod === 'MOBILE_MONEY' && (
              <TextInput
                mode="outlined"
                label="M-Pesa phone number"
                placeholder="2547XXXXXXXX"
                keyboardType="phone-pad"
                value={mpesaPhone}
                onChangeText={setMpesaPhone}
                style={styles.customerInput}
              />
            )}

            {checkoutStage && (
              <View style={styles.checkoutStageRow}>
                <ActivityIndicator size="small" color={brand.gradientEnd} />
                <Text style={styles.checkoutStageText}>{checkoutStage}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={closeChargeModal}
                disabled={chargeMutation.isPending}
                style={styles.modalActionButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => chargeMutation.mutate()}
                loading={chargeMutation.isPending}
                disabled={chargeMutation.isPending}
                style={styles.modalActionButton}
              >
                Confirm sale
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={!!receiptData}
          onDismiss={closeReceipt}
          dismissable={false}
          contentContainerStyle={styles.receiptModalContainer}
        >
          {receiptData && (
            <Receipt
              receipt={receiptData}
              settings={settings}
              qr={receiptQr}
              qrLoading={receiptQrLoading}
              onDone={closeReceipt}
            />
          )}
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={registerModal !== null}
          onDismiss={() => setRegisterModal(null)}
          contentContainerStyle={styles.modalContainer}
        >
          {registerModal === 'open' ? (
            <>
              <Text style={styles.modalTitle}>Open Register</Text>
              <Text style={styles.registerHint}>
                Enter the starting cash float to begin a new shift.
              </Text>
              <TextInput
                mode="outlined"
                label="Opening float (KES)"
                keyboardType="numeric"
                value={openingFloatInput}
                onChangeText={setOpeningFloatInput}
                style={styles.customerInput}
              />
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setRegisterModal(null)}
                  style={styles.modalActionButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    void register
                      .openRegister(Number(openingFloatInput) || 0)
                      .then(() => setRegisterModal(null));
                  }}
                  style={styles.modalActionButton}
                >
                  Open Register
                </Button>
              </View>
            </>
          ) : (
            <ScrollView>
              <Text style={styles.modalTitle}>Close Register</Text>
              <Text style={styles.registerHint}>
                Today&apos;s sales, for reconciliation against the till.
              </Text>
              {dailySummaryLoading ? (
                <ActivityIndicator
                  size="small"
                  color={brand.gradientEnd}
                  style={{ marginVertical: 12 }}
                />
              ) : (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalsLabel}>Orders</Text>
                    <Text style={styles.totalsValue}>
                      {dailySummary?.totalOrders ?? 0}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalsLabel}>Total revenue</Text>
                    <Text style={styles.totalsValue}>
                      {formatCurrency(dailySummary?.totalRevenue ?? 0)}
                    </Text>
                  </View>
                  <Divider style={styles.divider} />
                  {(dailySummary?.byPaymentMethod ?? []).map((row) => (
                    <View key={row.method} style={styles.summaryRow}>
                      <Text style={styles.totalsLabel}>
                        {PAYMENT_METHOD_LABELS[row.method] ?? row.method} (
                        {row.orders})
                      </Text>
                      <Text style={styles.totalsValue}>
                        {formatCurrency(row.amount)}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              <TextInput
                mode="outlined"
                label="Cash counted (KES)"
                keyboardType="numeric"
                value={cashCountedInput}
                onChangeText={setCashCountedInput}
                style={[styles.customerInput, { marginTop: 12 }]}
              />
              {cashCountedInput.trim().length > 0 &&
                (() => {
                  const expectedCash =
                    dailySummary?.byPaymentMethod.find(
                      (r) => r.method === 'CASH',
                    )?.amount ?? 0;
                  const variance = Number(cashCountedInput) - expectedCash;
                  return (
                    <Text
                      style={[
                        styles.varianceText,
                        {
                          color: variance === 0 ? brand.gradientEnd : '#d4380d',
                        },
                      ]}
                    >
                      Expected cash {formatCurrency(expectedCash)} · Variance{' '}
                      {variance >= 0 ? '+' : ''}
                      {formatCurrency(variance)}
                    </Text>
                  );
                })()}

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setRegisterModal(null)}
                  style={styles.modalActionButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    void register.closeRegister().then(() => {
                      setRegisterModal(null);
                      setSnackbar({
                        visible: true,
                        message: 'Register closed',
                      });
                    });
                  }}
                  style={styles.modalActionButton}
                >
                  Close Register
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={5000}
        style={snackbar.isError ? styles.snackbarError : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

const TILE_MIN_WIDTH = 140;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
    padding: 16,
  },
  emptyState: {
    paddingTop: 48,
    alignItems: 'center',
  },
  errorText: {
    color: brand.textMuted,
    textAlign: 'center',
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  searchbarInput: {
    fontSize: 14,
    minHeight: 0,
  },
  registerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  registerBannerOpen: {
    backgroundColor: '#d6f3ee',
  },
  registerBannerClosed: {
    backgroundColor: '#fbf1de',
  },
  registerBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  registerHint: {
    fontSize: 12.5,
    color: brand.textMuted,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  varianceText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
  },
  chipsRow: {
    flexGrow: 0,
    maxHeight: 40,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  chip: {
    marginRight: 0,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  gridRow: {
    gap: 10,
    paddingHorizontal: 4,
  },
  productTile: {
    flex: 1,
    minWidth: TILE_MIN_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  productAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  productAvatarLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  qtyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: brand.textDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  qtyBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  lowStockDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ad7a14',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  stockRibbon: {
    position: 'absolute',
    bottom: -8,
    left: -12,
    right: -12,
    backgroundColor: '#d4380d',
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  stockRibbonText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
    marginBottom: 2,
    minHeight: 32,
  },
  productCode: {
    fontSize: 10.5,
    color: brand.textMuted,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  cartDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#15101f',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  cartSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cartSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.gradientEnd,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartCountBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cartSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
  },
  cartSummaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cartSummaryTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  cartScroll: {
    flex: 1,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  cartLineSelected: {
    backgroundColor: '#d6f3ee',
  },
  cartLineInfo: {
    flex: 1,
    marginRight: 8,
  },
  cartLineName: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
  },
  cartLinePrice: {
    fontSize: 12,
    color: brand.textMuted,
  },
  cartLineTotal: {
    fontWeight: '700',
    color: brand.textDark,
  },
  cartLineStrike: {
    textDecorationLine: 'line-through',
    color: brand.textMuted,
  },
  cartLineDiscountTag: {
    color: '#ad7a14',
    fontWeight: '700',
  },
  cartLineControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
    minWidth: 20,
    textAlign: 'center',
  },
  numpadSection: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#f8f5ef',
    borderRadius: 12,
    marginBottom: 6,
  },
  numpadHint: {
    fontSize: 12,
    fontWeight: '600',
    color: brand.textMuted,
    marginBottom: 6,
  },
  divider: {
    marginVertical: 6,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 13,
    color: brand.textMuted,
  },
  totalsValue: {
    fontSize: 13,
    color: brand.textDark,
  },
  chargeButton: {
    marginTop: 10,
    borderRadius: 12,
  },
  chargeButtonContent: {
    paddingVertical: 4,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  receiptModalContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 40,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.textDark,
  },
  modalTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: brand.gradientEnd,
    marginBottom: 12,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  warehouseButtons: {
    marginBottom: 4,
  },
  customerInput: {
    backgroundColor: '#ffffff',
  },
  customerResults: {
    maxHeight: 120,
    marginTop: 4,
  },
  customerRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  customerRowSelected: {
    backgroundColor: '#d6f3ee',
  },
  customerRowText: {
    fontSize: 13,
    color: brand.textDark,
  },
  noCustomerText: {
    fontSize: 12,
    color: brand.textMuted,
    paddingVertical: 4,
  },
  selectedCustomerHint: {
    fontSize: 12,
    color: brand.textMuted,
    marginTop: 6,
  },
  checkoutStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  checkoutStageText: {
    fontSize: 12.5,
    color: brand.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
  },
  snackbarError: {
    backgroundColor: '#d4380d',
  },
});
