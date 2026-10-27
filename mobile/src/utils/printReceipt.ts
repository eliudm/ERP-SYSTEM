import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
