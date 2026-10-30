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
import { useTranslation } from 'react-i18next';
import { Customer } from '../../api/customers.api';
import { Warehouse } from '../../api/inventory.api';
import { brand } from '../../theme';

const PAYMENT_METHOD_LABEL_KEYS: Record<string, string> = {
  CASH: 'paymentMethods.cash',
  CARD: 'paymentMethods.card',
  MOBILE_MONEY: 'paymentMethods.mobileMoney',
  BANK_TRANSFER: 'paymentMethods.bankTransfer',
  CREDIT: 'paymentMethods.credit',
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
  disabledMethods?: string[];
  mpesaPhone: string;
  onMpesaPhoneChange: (value: string) => void;
  mpesaChannel: 'STK' | 'TILL';
  onMpesaChannelChange: (value: 'STK' | 'TILL') => void;
  tillMatching: boolean;
  pendingTillPayments: Array<{
    id: string;
    payerName: string;
    msisdn: string;
    amount: number;
    transTime: string;
  }>;
  fetchingTillPayments: boolean;
  onConfirmTillMatch: (tillPaymentId: string) => void;
  confirmingTillMatch: boolean;
  onCancelTillMatch: () => void;
  customerQuery: string;
  onCustomerQueryChange: (value: string) => void;
  customerResults: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  searchingCustomers: boolean;
  showCreateCustomerForm: boolean;
  onOpenCreateCustomerForm: () => void;
  onCancelCreateCustomerForm: () => void;
  newCustomerName: string;
  onNewCustomerNameChange: (value: string) => void;
  newCustomerPhone: string;
  onNewCustomerPhoneChange: (value: string) => void;
  newCustomerEmail: string;
  onNewCustomerEmailChange: (value: string) => void;
  newCustomerPin: string;
  onNewCustomerPinChange: (value: string) => void;
  creatingCustomer: boolean;
  onSubmitNewCustomer: () => void;
  warehouses: Warehouse[];
  warehouseId: string | undefined;
  onSelectWarehouse: (id: string) => void;
  checkoutStage: string | null;
  error: string | null;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  total,
  paymentMethods,
  paymentMethod,
  onSelectPaymentMethod,
  disabledMethods = [],
  mpesaPhone,
  onMpesaPhoneChange,
  mpesaChannel,
  onMpesaChannelChange,
  tillMatching,
  pendingTillPayments,
  fetchingTillPayments,
  onConfirmTillMatch,
  confirmingTillMatch,
  onCancelTillMatch,
  customerQuery,
  onCustomerQueryChange,
  customerResults,
  selectedCustomer,
  onSelectCustomer,
  searchingCustomers,
  showCreateCustomerForm,
  onOpenCreateCustomerForm,
  onCancelCreateCustomerForm,
  newCustomerName,
  onNewCustomerNameChange,
  newCustomerPhone,
  onNewCustomerPhoneChange,
  newCustomerEmail,
  onNewCustomerEmailChange,
  newCustomerPin,
  onNewCustomerPinChange,
  creatingCustomer,
  onSubmitNewCustomer,
  warehouses,
  warehouseId,
  onSelectWarehouse,
  checkoutStage,
  error,
  isSubmitting,
  onBack,
  onConfirm,
}) => {
  const { t } = useTranslation('pos');
  const paymentMethodLabel = (method: string) =>
    PAYMENT_METHOD_LABEL_KEYS[method]
      ? t(PAYMENT_METHOD_LABEL_KEYS[method])
      : method;

  if (tillMatching) {
    return (
      <View style={styles.container}>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <View style={styles.tillMatchingBody}>
          <Text style={styles.hint}>{t('noTillPaymentsYet')}</Text>
          {fetchingTillPayments && pendingTillPayments.length === 0 && (
            <ActivityIndicator size="small" style={{ marginVertical: 8 }} />
          )}
          {pendingTillPayments.map((tx) => (
            <Pressable
              key={tx.id}
              style={styles.customerRow}
              onPress={() => onConfirmTillMatch(tx.id)}
              disabled={confirmingTillMatch}
            >
              <Text style={styles.customerRowText}>
                {(tx.payerName || tx.msisdn) +
                  ' — ' +
                  formatCurrency(tx.amount)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={onCancelTillMatch}
            disabled={confirmingTillMatch}
          >
            {t('common:cancel')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.total}>{formatCurrency(total)}</Text>

      <View style={styles.methodGrid}>
        {paymentMethods.map((method) => {
          const selected = paymentMethod === method;
          const disabled = disabledMethods.includes(method);
          return (
            <Pressable
              key={method}
              style={[
                styles.methodTile,
                selected && styles.methodTileSelected,
                disabled && styles.methodTileDisabled,
              ]}
              onPress={() => {
                if (!disabled) onSelectPaymentMethod(method);
              }}
            >
              <View style={styles.methodTileRow}>
                <MaterialCommunityIcons
                  name={(PAYMENT_METHOD_ICONS[method] ?? 'cash') as never}
                  size={22}
                  color={
                    disabled
                      ? brand.textMuted
                      : selected
                        ? brand.gradientEnd
                        : brand.textMuted
                  }
                />
                <Text
                  style={[
                    styles.methodLabel,
                    selected && styles.methodLabelSelected,
                    disabled && styles.methodLabelDisabled,
                  ]}
                >
                  {paymentMethodLabel(method)}
                </Text>
              </View>
              {disabled && (
                <Text style={styles.methodCaption}>
                  {t('needsInternetCaption')}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.detailsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {paymentMethod === 'MOBILE_MONEY' && (
          <>
            <SegmentedButtons
              value={mpesaChannel}
              onValueChange={(v) => onMpesaChannelChange(v)}
              buttons={[
                { value: 'STK', label: t('mpesaChannel.stk') },
                { value: 'TILL', label: t('mpesaChannel.till') },
              ]}
              style={styles.input}
            />
            {mpesaChannel === 'STK' ? (
              <TextInput
                mode="outlined"
                label={t('mpesaPhoneNumberLabel')}
                placeholder={t('placeholder.mpesaNumber')}
                keyboardType="phone-pad"
                value={mpesaPhone}
                onChangeText={onMpesaPhoneChange}
                style={styles.input}
              />
            ) : (
              <Text style={styles.hint}>{t('tillPushNotice')}</Text>
            )}
          </>
        )}

        <Text style={styles.sectionLabel}>{t('common:customer')}</Text>
        <TextInput
          mode="outlined"
          placeholder={t('customerSearchPlaceholder')}
          value={customerQuery}
          onChangeText={onCustomerQueryChange}
          dense
          style={styles.input}
        />
        {searchingCustomers && (
          <ActivityIndicator size="small" style={{ marginVertical: 4 }} />
        )}
        {!searchingCustomers &&
          customerQuery.trim().length > 0 &&
          !showCreateCustomerForm && (
            <View style={styles.customerResults}>
              {customerResults.length === 0 ? (
                <>
                  <Text style={styles.hint}>{t('noCustomerMatchesHint')}</Text>
                  <Button
                    mode="text"
                    icon="account-plus-outline"
                    onPress={onOpenCreateCustomerForm}
                    style={styles.createCustomerButton}
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {t('createCustomerNamed', { name: customerQuery.trim() })}
                  </Button>
                </>
              ) : (
                customerResults.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.customerRow,
                      selectedCustomer?.id === c.id &&
                        styles.customerRowSelected,
                    ]}
                    onPress={() => onSelectCustomer(c)}
                  >
                    <Text style={styles.customerRowText}>{c.name}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

        {showCreateCustomerForm && (
          <View style={styles.createCustomerForm}>
            <TextInput
              mode="outlined"
              label={t('common:name')}
              value={newCustomerName}
              onChangeText={onNewCustomerNameChange}
              dense
              style={styles.input}
              autoFocus
            />
            <TextInput
              mode="outlined"
              label={t('common:phone')}
              value={newCustomerPhone}
              onChangeText={onNewCustomerPhoneChange}
              keyboardType="phone-pad"
              dense
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label={t('common:email')}
              value={newCustomerEmail}
              onChangeText={onNewCustomerEmailChange}
              keyboardType="email-address"
              dense
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label={t('taxPinLabel')}
              value={newCustomerPin}
              onChangeText={onNewCustomerPinChange}
              dense
              style={styles.input}
            />
            <View style={styles.createCustomerActions}>
              <Button
                mode="text"
                onPress={onCancelCreateCustomerForm}
                disabled={creatingCustomer}
              >
                {t('common:cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={onSubmitNewCustomer}
                loading={creatingCustomer}
                disabled={creatingCustomer}
              >
                {t('common:save')}
              </Button>
            </View>
          </View>
        )}

        {!showCreateCustomerForm && (
          <Text style={styles.hint}>
            {selectedCustomer
              ? t('selectedCustomerHint', { name: selectedCustomer.name })
              : t('willUseWalkIn')}
          </Text>
        )}

        {warehouses.length > 1 && (
          <>
            <Text style={styles.sectionLabel}>{t('common:warehouse')}</Text>
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

      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color="#d4380d"
          />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

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
          {PAYMENT_METHOD_LABEL_KEYS[paymentMethod]
            ? paymentMethodLabel(paymentMethod)
            : t('common:confirm')}
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
    gap: 2,
  },
  methodTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  methodTileSelected: {
    backgroundColor: '#d6f3ee',
    borderWidth: 1.5,
    borderColor: brand.gradientEnd,
  },
  methodTileDisabled: {
    backgroundColor: '#f5f3ef',
    opacity: 0.6,
  },
  methodCaption: {
    fontSize: 10.5,
    color: brand.textMuted,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
  },
  methodLabelSelected: {
    color: brand.gradientEnd,
  },
  methodLabelDisabled: {
    color: brand.textMuted,
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
  createCustomerButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  createCustomerForm: {
    marginTop: 4,
    marginBottom: 8,
  },
  tillMatchingBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  createCustomerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fde3dc',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#d4380d',
    fontWeight: '600',
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
