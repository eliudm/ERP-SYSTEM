import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import {
  Text,
  Button,
  IconButton,
  TextInput,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Customer } from '../../api/customers.api';
import { Warehouse } from '../../api/inventory.api';
import { brand } from '../../theme';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

const PAYMENT_METHOD_ICONS: Record<string, string> = {
  CASH: 'cash',
  CARD: 'credit-card-outline',
  MOBILE_MONEY: 'cellphone',
  BANK_TRANSFER: 'bank-outline',
  CREDIT: 'account-clock-outline',
};

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PaymentScreenProps {
  total: number;
  paymentMethods: string[];
  paymentMethod: string;
  onSelectPaymentMethod: (method: string) => void;
  mpesaPhone: string;
  onMpesaPhoneChange: (value: string) => void;
  customerQuery: string;
  onCustomerQueryChange: (value: string) => void;
  customerResults: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  searchingCustomers: boolean;
  warehouses: Warehouse[];
  warehouseId: string | undefined;
  onSelectWarehouse: (id: string) => void;
  checkoutStage: string | null;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  total,
  paymentMethods,
  paymentMethod,
  onSelectPaymentMethod,
  mpesaPhone,
  onMpesaPhoneChange,
  customerQuery,
  onCustomerQueryChange,
  customerResults,
  selectedCustomer,
  onSelectCustomer,
  searchingCustomers,
  warehouses,
  warehouseId,
  onSelectWarehouse,
  checkoutStage,
  isSubmitting,
  onBack,
  onConfirm,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.total}>{formatCurrency(total)}</Text>

      <View style={styles.methodGrid}>
        {paymentMethods.map((method) => {
          const selected = paymentMethod === method;
          return (
            <Pressable
              key={method}
              style={[styles.methodTile, selected && styles.methodTileSelected]}
              onPress={() => onSelectPaymentMethod(method)}
            >
              <MaterialCommunityIcons
                name={(PAYMENT_METHOD_ICONS[method] ?? 'cash') as never}
                size={22}
                color={selected ? brand.gradientEnd : brand.textMuted}
              />
              <Text
                style={[
                  styles.methodLabel,
                  selected && styles.methodLabelSelected,
                ]}
              >
                {PAYMENT_METHOD_LABELS[method] ?? method}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.detailsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {paymentMethod === 'MOBILE_MONEY' && (
          <TextInput
            mode="outlined"
            label="M-Pesa phone number"
            placeholder="2547XXXXXXXX"
            keyboardType="phone-pad"
            value={mpesaPhone}
            onChangeText={onMpesaPhoneChange}
            style={styles.input}
          />
        )}

        <Text style={styles.sectionLabel}>Customer</Text>
        <TextInput
          mode="outlined"
          placeholder="Search, or leave blank for Walk-in Customer"
          value={customerQuery}
          onChangeText={onCustomerQueryChange}
          dense
          style={styles.input}
        />
        {searchingCustomers && (
          <ActivityIndicator size="small" style={{ marginVertical: 4 }} />
        )}
        {!searchingCustomers && customerQuery.trim().length > 0 && (
          <View style={styles.customerResults}>
            {customerResults.length === 0 ? (
              <Text style={styles.hint}>
                No matches — will use Walk-in Customer
              </Text>
            ) : (
              customerResults.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.customerRow,
                    selectedCustomer?.id === c.id && styles.customerRowSelected,
                  ]}
                  onPress={() => onSelectCustomer(c)}
                >
                  <Text style={styles.customerRowText}>{c.name}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
        <Text style={styles.hint}>
          {selectedCustomer
            ? `Selected: ${selectedCustomer.name}`
            : 'Will use: Walk-in Customer'}
        </Text>

        {warehouses.length > 1 && (
          <>
            <Text style={styles.sectionLabel}>Warehouse</Text>
            <SegmentedButtons
              value={warehouseId ?? ''}
              onValueChange={onSelectWarehouse}
              buttons={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              style={styles.input}
            />
          </>
        )}

        {checkoutStage && (
          <View style={styles.stageRow}>
            <ActivityIndicator size="small" color={brand.gradientEnd} />
            <Text style={styles.stageText}>{checkoutStage}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <IconButton
          icon="chevron-left"
          mode="outlined"
          onPress={onBack}
          disabled={isSubmitting}
        />
        <Button
          mode="contained"
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
          onPress={onConfirm}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {PAYMENT_METHOD_LABELS[paymentMethod] ?? 'Confirm'}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  total: {
    fontSize: 32,
    fontWeight: '700',
    color: brand.textDark,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  methodTile: {
    width: '47%',
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: '#f0eef7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexDirection: 'row',
  },
  methodTileSelected: {
    backgroundColor: '#d6f3ee',
    borderWidth: 1.5,
    borderColor: brand.gradientEnd,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
  },
  methodLabelSelected: {
    color: brand.gradientEnd,
  },
  detailsScroll: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  customerResults: {
    maxHeight: 120,
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
  hint: {
    fontSize: 12,
    color: brand.textMuted,
    marginTop: 4,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  stageText: {
    fontSize: 12.5,
    color: brand.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0eef7',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
  },
  confirmButtonContent: {
    paddingVertical: 6,
  },
});
