import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { brand } from '../theme';
import { SystemSettings } from '../api/settings.api';
import { EtimsQrResult } from '../api/etims.api';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptData {
  invoiceNo: string;
  createdAt: string;
  customerName: string;
  servedBy: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod?: string;
  items: ReceiptItem[];
}

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReceiptProps {
  receipt: ReceiptData;
  settings?: SystemSettings;
  qr: EtimsQrResult | null;
  qrLoading: boolean;
  onDone: () => void;
}

export const Receipt: React.FC<ReceiptProps> = ({
  receipt,
  settings,
  qr,
  qrLoading,
  onDone,
}) => {
  const businessName = settings?.companyName || 'Nexora ERP';
  const showBranding = settings?.posReceiptBranding ?? true;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.businessName}>{businessName}</Text>
          {showBranding && settings?.companyAddress && (
            <Text style={styles.headerLine}>{settings.companyAddress}</Text>
          )}
          {showBranding && settings?.companyPin && (
            <Text style={styles.headerLine}>PIN: {settings.companyPin}</Text>
          )}
        </View>

        <Divider style={styles.dashedDivider} />

        <View style={styles.meta}>
          <Text style={styles.metaLine}>Invoice: {receipt.invoiceNo}</Text>
          <Text style={styles.metaLine}>
            {new Date(receipt.createdAt).toLocaleString()}
          </Text>
          <Text style={styles.metaLine}>Served by: {receipt.servedBy}</Text>
          {receipt.customerName !== 'Walk-in Customer' && (
            <Text style={styles.metaLine}>
              Customer: {receipt.customerName}
            </Text>
          )}
        </View>

        <Divider style={styles.dashedDivider} />

        {receipt.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.quantity} x {formatCurrency(item.unitPrice)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatCurrency(item.unitPrice * item.quantity)}
            </Text>
          </View>
        ))}

        <Divider style={styles.dashedDivider} />

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>
            {formatCurrency(receipt.subtotal)}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>VAT</Text>
          <Text style={styles.totalsValue}>
            {formatCurrency(receipt.taxTotal)}
          </Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(receipt.total)}
          </Text>
        </View>
        {receipt.paymentMethod && (
          <Text style={styles.paymentMethod}>
            Paid via {receipt.paymentMethod.replace('_', ' ')}
          </Text>
        )}

        <View style={styles.qrSection}>
          {qrLoading ? (
            <>
              <ActivityIndicator size="small" color={brand.gradientEnd} />
              <Text style={styles.qrLabel}>Fetching eTIMS QR…</Text>
            </>
          ) : qr?.qrCode ? (
            <>
              <Image source={{ uri: qr.qrCode }} style={styles.qrImage} />
              <Text style={styles.qrLabel}>
                {qr.provisional ? 'Provisional Receipt QR' : 'eTIMS QR Code'}
              </Text>
              {qr.message && <Text style={styles.qrMessage}>{qr.message}</Text>}
            </>
          ) : (
            <Text style={styles.qrLabel}>eTIMS QR code pending</Text>
          )}
        </View>
      </ScrollView>

      <Button
        mode="contained"
        onPress={onDone}
        style={styles.doneButton}
        contentStyle={styles.doneButtonContent}
      >
        New Sale
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  businessName: {
    fontSize: 17,
    fontWeight: '700',
    color: brand.textDark,
  },
  headerLine: {
    fontSize: 11.5,
    color: brand.textMuted,
    marginTop: 2,
  },
  dashedDivider: {
    marginVertical: 10,
    borderStyle: 'dashed',
  },
  meta: {
    alignItems: 'center',
  },
  metaLine: {
    fontSize: 11.5,
    color: brand.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
  },
  itemMeta: {
    fontSize: 11,
    color: brand.textMuted,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
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
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: brand.textDark,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  paymentMethod: {
    textAlign: 'center',
    fontSize: 12,
    color: brand.textMuted,
    marginTop: 8,
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ece8f5',
    borderStyle: 'dashed',
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  qrLabel: {
    fontSize: 11.5,
    color: brand.textMuted,
    marginTop: 6,
  },
  qrMessage: {
    fontSize: 10.5,
    color: brand.textMuted,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  doneButton: {
    marginVertical: 12,
    borderRadius: 12,
  },
  doneButtonContent: {
    paddingVertical: 6,
  },
});
