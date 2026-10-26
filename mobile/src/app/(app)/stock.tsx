import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Searchbar,
  Chip,
  Button,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Snackbar,
  SegmentedButtons,
  FAB,
  Divider,
} from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mobileApi, PosProduct } from '../../api/mobile.api';
import {
  inventoryApi,
  StockMovement,
  CreateStockMovementPayload,
} from '../../api/inventory.api';
import { useSession } from '../../providers/SessionProvider';
import { brand } from '../../theme';

const ALLOWED_ROLES = ['ADMIN', 'INVENTORY_MANAGER'];

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MOVEMENT_STYLES: Record<
  string,
  { bg: string; fg: string; sign: string }
> = {
  IN: { bg: '#d6f3ee', fg: '#0d7a66', sign: '+' },
  OUT: { bg: '#fde1dc', fg: '#d4380d', sign: '-' },
  ADJUSTMENT: { bg: '#fff3d6', fg: '#ad7a14', sign: '±' },
};

const MovementTypeChip: React.FC<{ type: string }> = ({ type }) => {
  const style = MOVEMENT_STYLES[type] ?? MOVEMENT_STYLES.ADJUSTMENT;
  return (
    <Chip
      compact
      style={[styles.typeChip, { backgroundColor: style.bg }]}
      textStyle={[styles.typeChipText, { color: style.fg }]}
    >
      {type}
    </Chip>
  );
};

const ProductRow: React.FC<{
  product: PosProduct;
  onReceive: (product: PosProduct) => void;
}> = ({ product, onReceive }) => (
  <Card style={styles.card} mode="contained">
    <Card.Content style={styles.cardContent}>
      <View style={styles.cardLeft}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.productCode}>{product.code}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text
          style={[
            styles.stockQty,
            product.stockQuantity <= 0 && styles.stockQtyZero,
          ]}
        >
          {product.stockQuantity} in stock
        </Text>
        <Button
          mode="contained-tonal"
          compact
          onPress={() => onReceive(product)}
          style={styles.receiveButton}
          labelStyle={styles.receiveButtonLabel}
        >
          Receive
        </Button>
      </View>
    </Card.Content>
  </Card>
);

const MovementRow: React.FC<{ movement: StockMovement }> = ({ movement }) => (
  <Card style={styles.card} mode="contained">
    <Card.Content style={styles.cardContent}>
      <View style={styles.cardLeft}>
        <Text style={styles.productName} numberOfLines={1}>
          {movement.product?.name ?? 'Unknown product'}
        </Text>
        <Text style={styles.productCode} numberOfLines={1}>
          {movement.warehouse?.name ?? 'Warehouse'} ·{' '}
          {formatDateTime(movement.createdAt)}
        </Text>
        {(movement.reference || movement.notes) && (
          <Text style={styles.movementNote} numberOfLines={2}>
            {[movement.reference, movement.notes].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.movementQty}>
          {
            (
              MOVEMENT_STYLES[movement.movementType] ??
              MOVEMENT_STYLES.ADJUSTMENT
            ).sign
          }
          {movement.quantity}
        </Text>
        <MovementTypeChip type={movement.movementType} />
      </View>
    </Card.Content>
  </Card>
);

export default function StockScreen() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const allowed = !!user?.role && ALLOWED_ROLES.includes(user.role);

  const [view, setView] = useState<'products' | 'history'>('products');
  const [search, setSearch] = useState('');

  const [receiveVisible, setReceiveVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(
    null,
  );
  const [productPickerQuery, setProductPickerQuery] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    isError?: boolean;
  }>({ visible: false, message: '' });

  const {
    data: posData,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['pos-data'],
    queryFn: () => mobileApi.getPosData(),
    enabled: allowed,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
    enabled: allowed,
  });

  const {
    data: movementsPage,
    isLoading: movementsLoading,
    isRefetching: movementsRefetching,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryApi.getStockMovements(1, 30),
    enabled: allowed,
  });

  const products = posData?.products ?? [];
  const movements = movementsPage?.data ?? [];
  const activeWarehouseId = warehouseId ?? warehouses[0]?.id;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }, [products, search]);

  const productPickerResults = useMemo(() => {
    const q = productPickerQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productPickerQuery]);

  const resetReceiveForm = () => {
    setSelectedProduct(null);
    setProductPickerQuery('');
    setWarehouseId(undefined);
    setQuantity('');
    setUnitCost('');
    setReference('');
    setNotes('');
  };

  const openReceiveModal = (product?: PosProduct) => {
    resetReceiveForm();
    if (product) {
      setSelectedProduct(product);
    }
    setReceiveVisible(true);
  };

  const closeReceiveModal = () => {
    if (receiveMutation.isPending) return;
    setReceiveVisible(false);
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) {
        throw new Error('Select a product to receive stock for.');
      }
      if (!activeWarehouseId) {
        throw new Error('No warehouse is available to receive stock into.');
      }
      const qty = parseFloat(quantity);
      if (Number.isNaN(qty) || qty <= 0) {
        throw new Error('Enter a valid quantity greater than zero.');
      }
      let cost: number | undefined;
      if (unitCost.trim()) {
        const parsedCost = parseFloat(unitCost);
        if (Number.isNaN(parsedCost) || parsedCost < 0) {
          throw new Error('Enter a valid unit cost.');
        }
        cost = parsedCost;
      }

      const payload: CreateStockMovementPayload = {
        productId: selectedProduct.id,
        warehouseId: activeWarehouseId,
        movementType: 'IN',
        quantity: qty,
        ...(cost !== undefined ? { unitCost: cost } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      return inventoryApi.createStockMovement(payload);
    },
    onSuccess: () => {
      setReceiveVisible(false);
      setSnackbar({
        visible: true,
        message: 'Stock received successfully.',
      });
      resetReceiveForm();
      void queryClient.invalidateQueries({ queryKey: ['pos-data'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
    onError: (err: any) => {
      const message =
        err?.message ??
        err?.response?.data?.message ??
        'Failed to receive stock. Please try again.';
      setSnackbar({
        visible: true,
        message: Array.isArray(message) ? message.join(', ') : message,
        isError: true,
      });
    },
  });

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.notAllowedText}>
          Stock management is only available to inventory managers and admins.
        </Text>
      </View>
    );
  }

  const isLoading = productsLoading || movementsLoading;

  return (
    <View style={styles.container}>
      <View style={styles.segmentWrap}>
        <SegmentedButtons
          value={view}
          onValueChange={(v) => setView(v)}
          buttons={[
            { value: 'products', label: 'Products' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {view === 'products' ? (
        <>
          <Searchbar
            placeholder="Search name, code, or barcode"
            value={search}
            onChangeText={setSearch}
            style={styles.searchbar}
            inputStyle={styles.searchbarInput}
          />
          {productsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={brand.gradientEnd} />
            </View>
          ) : productsError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Failed to load products.</Text>
              <Button
                mode="contained"
                onPress={() => void refetchProducts()}
                style={{ marginTop: 12 }}
              >
                Retry
              </Button>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.content}
              renderItem={({ item }) => (
                <ProductRow product={item} onReceive={openReceiveModal} />
              )}
              refreshControl={
                <RefreshControl
                  refreshing={productsLoading}
                  onRefresh={() => void refetchProducts()}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try a different search term.
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => <MovementRow movement={item} />}
          refreshControl={
            <RefreshControl
              refreshing={movementsRefetching}
              onRefresh={() => void refetchMovements()}
            />
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={brand.gradientEnd} />
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No stock movements yet</Text>
                <Text style={styles.emptySubtitle}>
                  Received, issued, and adjusted stock will show up here.
                </Text>
              </View>
            )
          }
        />
      )}

      <FAB
        icon="plus"
        label="Receive Stock"
        style={styles.fab}
        color="#ffffff"
        onPress={() => openReceiveModal()}
      />

      <Portal>
        <Modal
          visible={receiveVisible}
          onDismiss={closeReceiveModal}
          dismissable={!receiveMutation.isPending}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Receive Stock</Text>

          <Text style={styles.modalSectionLabel}>Product</Text>
          {selectedProduct ? (
            <View style={styles.selectedProductRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedProductName}>
                  {selectedProduct.name}
                </Text>
                <Text style={styles.productCode}>
                  {selectedProduct.code} · Currently{' '}
                  {selectedProduct.stockQuantity} in stock
                </Text>
              </View>
              <IconButton
                icon="close"
                size={18}
                onPress={() => setSelectedProduct(null)}
              />
            </View>
          ) : (
            <>
              <TextInput
                mode="outlined"
                placeholder="Search product by name or code"
                value={productPickerQuery}
                onChangeText={setProductPickerQuery}
                dense
                style={styles.pickerInput}
              />
              {productPickerQuery.trim().length > 0 && (
                <View style={styles.pickerResults}>
                  {productPickerResults.length === 0 ? (
                    <Text style={styles.noResultsText}>
                      No matching products.
                    </Text>
                  ) : (
                    productPickerResults.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setSelectedProduct(p);
                          setProductPickerQuery('');
                        }}
                      >
                        <Text style={styles.pickerRow}>
                          {p.name} ({p.code})
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}

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

          <Text style={styles.modalSectionLabel}>Quantity received</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. 50"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            dense
            style={styles.pickerInput}
          />

          <Text style={styles.modalSectionLabel}>Unit cost (optional)</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. 120.00"
            keyboardType="numeric"
            value={unitCost}
            onChangeText={setUnitCost}
            dense
            style={styles.pickerInput}
          />

          <Text style={styles.modalSectionLabel}>Reference (optional)</Text>
          <TextInput
            mode="outlined"
            placeholder="PO number, delivery note, etc."
            value={reference}
            onChangeText={setReference}
            dense
            style={styles.pickerInput}
          />

          <Text style={styles.modalSectionLabel}>Notes (optional)</Text>
          <TextInput
            mode="outlined"
            placeholder="Any additional detail"
            value={notes}
            onChangeText={setNotes}
            dense
            multiline
            style={styles.pickerInput}
          />

          <Divider style={styles.divider} />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={closeReceiveModal}
              disabled={receiveMutation.isPending}
              style={styles.modalActionButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => receiveMutation.mutate()}
              loading={receiveMutation.isPending}
              disabled={receiveMutation.isPending}
              style={styles.modalActionButton}
            >
              Confirm receipt
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
    padding: 24,
  },
  notAllowedText: {
    color: brand.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    color: brand.textMuted,
    textAlign: 'center',
  },
  segmentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f8f5ef',
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    elevation: 0,
  },
  searchbarInput: {
    fontSize: 14,
    minHeight: 0,
  },
  content: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 96,
    gap: 10,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.textDark,
  },
  productCode: {
    fontSize: 12,
    color: brand.textMuted,
  },
  movementNote: {
    fontSize: 11.5,
    color: brand.textMuted,
    marginTop: 2,
  },
  stockQty: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.gradientEnd,
  },
  stockQtyZero: {
    color: '#d4380d',
  },
  receiveButton: {
    borderRadius: 10,
  },
  receiveButtonLabel: {
    fontSize: 12,
    marginVertical: 4,
  },
  movementQty: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  typeChip: {
    height: 26,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.textDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brand.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 16,
    backgroundColor: brand.gradientEnd,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.textDark,
    marginBottom: 4,
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
  pickerInput: {
    backgroundColor: '#ffffff',
  },
  pickerResults: {
    maxHeight: 160,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#f8f5ef',
  },
  pickerRow: {
    fontSize: 13,
    color: brand.textDark,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  noResultsText: {
    fontSize: 12,
    color: brand.textMuted,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectedProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d6f3ee',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectedProductName: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.textDark,
  },
  warehouseButtons: {
    marginBottom: 4,
  },
  divider: {
    marginTop: 16,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
  },
  snackbarError: {
    backgroundColor: '#d4380d',
  },
});
