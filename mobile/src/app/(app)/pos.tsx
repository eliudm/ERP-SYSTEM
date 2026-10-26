import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Badge,
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
} from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mobileApi, PosProduct } from '../../api/mobile.api';
import { customersApi, Customer } from '../../api/customers.api';
import { salesApi } from '../../api/sales.api';
import { brand } from '../../theme';

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

export default function PosScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pos-data'],
    queryFn: () => mobileApi.getPosData(),
  });

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [chargeVisible, setChargeVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(
    undefined,
  );
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [searchingCustomers, setSearchingCustomers] = useState(false);

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
          unitPrice: product.unitPrice,
          taxRate: product.taxRate,
          quantity: 1,
        },
      ];
    });
  };

  const incrementLine = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const resetChargeModal = () => {
    setPaymentMethod(undefined);
    setCustomerQuery('');
    setCustomerResults([]);
    setSelectedCustomer(null);
  };

  const openChargeModal = () => {
    resetChargeModal();
    setChargeVisible(true);
  };

  const closeChargeModal = () => {
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

  const resolveWalkInCustomer = async (): Promise<Customer> => {
    const matches = await customersApi.getCustomers(WALK_IN_CUSTOMER_NAME);
    const existing = matches.find((c) => c.name === WALK_IN_CUSTOMER_NAME);
    if (existing) return existing;
    return customersApi.createCustomer({ name: WALK_IN_CUSTOMER_NAME });
  };

  const chargeMutation = useMutation({
    mutationFn: async () => {
      const customer = selectedCustomer ?? (await resolveWalkInCustomer());
      return salesApi.createInvoice({
        customerId: customer.id,
        invoiceDate: new Date().toISOString(),
        paymentMethod,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
        })),
      });
    },
    onSuccess: (invoice) => {
      setCart([]);
      setChargeVisible(false);
      setSnackbar({
        visible: true,
        message: `Sale completed: invoice ${invoice.invoiceNo}`,
      });
      void queryClient.invalidateQueries({ queryKey: ['mobile-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['pos-data'] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ??
        'Failed to complete sale. Please try again.';
      setSnackbar({
        visible: true,
        message: Array.isArray(message) ? message.join(', ') : message,
        isError: true,
      });
    },
  });

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
      />

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
            >
              {cat.name}
            </Chip>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.errorText}>No products match your search.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.productCardWrap}
            onPress={() => addToCart(item)}
          >
            <Card style={styles.productCard} mode="contained">
              <Card.Content>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.productCode}>{item.code}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>
                    {formatCurrency(item.unitPrice)}
                  </Text>
                  {item.stockQuantity <= 5 && (
                    <Badge style={styles.lowStockBadge}>
                      {item.stockQuantity}
                    </Badge>
                  )}
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        )}
      />

      <Card style={styles.cartCard} mode="contained">
        <Card.Content style={styles.cartContent}>
          <Text style={styles.heading}>Cart ({cart.length})</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyCartText}>
              Tap a product to add it to the cart.
            </Text>
          ) : (
            <ScrollView style={styles.cartList}>
              {cart.map((line) => (
                <View key={line.productId} style={styles.cartLine}>
                  <View style={styles.cartLineInfo}>
                    <Text style={styles.cartLineName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={styles.cartLinePrice}>
                      {formatCurrency(line.unitPrice)} x {line.quantity}
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
                </View>
              ))}
            </ScrollView>
          )}

          <Divider style={styles.divider} />

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{formatCurrency(taxTotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabelBold}>Total</Text>
            <Text style={styles.totalsValueBold}>{formatCurrency(total)}</Text>
          </View>

          <Button
            mode="contained"
            style={styles.chargeButton}
            disabled={cart.length === 0}
            onPress={openChargeModal}
          >
            Charge
          </Button>
        </Card.Content>
      </Card>

      <Portal>
        <Modal
          visible={chargeVisible}
          onDismiss={closeChargeModal}
          contentContainerStyle={styles.modalContainer}
        >
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
                  No matches. Will create a new customer? Clear search to use
                  Walk-in Customer, or try another name.
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
                    onPress={() => setSelectedCustomer(c)}
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

          <Text style={styles.modalSectionLabel}>Payment method</Text>
          <RadioButton.Group
            onValueChange={(value) => setPaymentMethod(value)}
            value={paymentMethod ?? ''}
          >
            {paymentMethods.map((method) => (
              <RadioButton.Item key={method} label={method} value={method} />
            ))}
          </RadioButton.Group>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={closeChargeModal}
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
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={4000}
        style={snackbar.isError ? styles.snackbarError : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

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
  chipsRow: {
    maxHeight: 44,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    marginRight: 8,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  gridRow: {
    gap: 12,
  },
  productCardWrap: {
    flex: 1,
    marginBottom: 12,
  },
  productCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
    marginBottom: 4,
  },
  productCode: {
    fontSize: 11,
    color: brand.textMuted,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  lowStockBadge: {
    backgroundColor: '#d4380d',
  },
  cartCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    maxHeight: '48%',
  },
  cartContent: {
    gap: 4,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginBottom: 4,
  },
  emptyCartText: {
    color: brand.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  cartList: {
    maxHeight: 160,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
  divider: {
    marginVertical: 8,
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
  totalsLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  totalsValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  chargeButton: {
    marginTop: 10,
    borderRadius: 12,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
