import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// react-native-printer-usb's printHtml rasterizes a static HTML string to the
// printer — the print-triggering <script> receiptHtml.ts appends for the
// AirPrint path has nothing to call window.print() on here and would just be
// dead weight, so it's stripped before handing the HTML off.
const stripPrintScript = (html: string): string =>
  html.replace(/<script>[\s\S]*?<\/script>/, '');

// expo-print's printAsync ignores the `html` option on web (it prints the
// current page instead), so web falls back to the same
// window.open + document.write + window.print() approach the browser POS
// already uses — keeps "print" working everywhere this app runs.
export const printReceiptHtml = async (html: string): Promise<void> => {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank', 'width=360,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    return;
  }
  await Print.printAsync({ html });
};

// Fallback for when there's no printer to print to (no AirPrint printer on
// iOS, no printer configured on Android) — renders the receipt to an actual
// PDF file instead and opens the share sheet so it can be saved or sent on.
// On web there's no local-file PDF to generate; the browser's own print
// dialog already offers "Save as PDF" as a destination, so this just opens
// that same dialog.
export const saveReceiptPdf = async (html: string): Promise<void> => {
  if (Platform.OS === 'web') {
    await printReceiptHtml(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save receipt',
      UTI: 'com.adobe.pdf',
    });
  }
};

// Prints directly to a cable-connected USB thermal printer, bypassing the OS
// print dialog entirely — most thermal receipt printers don't register as an
// AirPrint/print-service destination at all. Android-only: iOS would need
// Apple MFi-certified accessory hardware most thermal printers don't have.
// The native module is dynamically imported so it's never touched on iOS/web,
// where it isn't usable anyway.
export const printReceiptUsb = async (html: string): Promise<void> => {
  if (Platform.OS !== 'android') {
    throw new Error('USB printing is only available on Android.');
  }

  const { getList, printHtml } = await import('react-native-printer-usb');
  const devices = getList();
  const device = devices[0];
  if (!device) {
    throw new Error(
      'No USB printer detected. Connect one via cable and try again.',
    );
  }

  const result = await printHtml({
    html: stripPrintScript(html),
    productId: device.productId,
    align: 'center',
  });

  if (!result.success) {
    throw new Error(result.message || 'Failed to print to the USB printer.');
  }
};
