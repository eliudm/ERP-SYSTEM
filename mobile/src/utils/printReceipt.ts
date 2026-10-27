import { Platform } from 'react-native';
import * as Print from 'expo-print';

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
