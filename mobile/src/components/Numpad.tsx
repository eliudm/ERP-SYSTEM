import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { brand } from '../theme';

export type NumpadMode = 'qty' | 'discount' | 'price';

interface NumpadProps {
  mode: NumpadMode;
  onModeChange: (mode: NumpadMode) => void;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
}

// Odoo-style numpad: tap a cart line to select it, then type a value here
// to set its quantity/discount/price directly. The rightmost column is the
// mode selector (Qty / % / Price) rather than a separate control above it.
export const Numpad: React.FC<NumpadProps> = ({
  mode,
  onModeChange,
  onKeyPress,
  onBackspace,
}) => {
  const Key: React.FC<{
    label: string;
    onPress: () => void;
    tone?: 'default' | 'active' | 'danger' | 'warning';
  }> = ({ label, onPress, tone = 'default' }) => (
    <Pressable
      style={({ pressed }) => [
        styles.key,
        tone === 'active' && styles.keyActive,
        tone === 'danger' && styles.keyDanger,
        tone === 'warning' && styles.keyWarning,
        pressed && styles.keyPressed,
      ]}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.keyText,
            tone === 'active' && styles.keyTextActive,
            pressed && styles.keyTextPressed,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Key label="1" onPress={() => onKeyPress('1')} />
        <Key label="2" onPress={() => onKeyPress('2')} />
        <Key label="3" onPress={() => onKeyPress('3')} />
        <Key
          label="Qty"
          tone={mode === 'qty' ? 'active' : 'default'}
          onPress={() => onModeChange('qty')}
        />
      </View>
      <View style={styles.row}>
        <Key label="4" onPress={() => onKeyPress('4')} />
        <Key label="5" onPress={() => onKeyPress('5')} />
        <Key label="6" onPress={() => onKeyPress('6')} />
        <Key
          label="%"
          tone={mode === 'discount' ? 'active' : 'default'}
          onPress={() => onModeChange('discount')}
        />
      </View>
      <View style={styles.row}>
        <Key label="7" onPress={() => onKeyPress('7')} />
        <Key label="8" onPress={() => onKeyPress('8')} />
        <Key label="9" onPress={() => onKeyPress('9')} />
        <Key
          label="Price"
          tone={mode === 'price' ? 'active' : 'default'}
          onPress={() => onModeChange('price')}
        />
      </View>
      <View style={styles.row}>
        <Key label="+/-" tone="warning" onPress={() => onKeyPress('+/-')} />
        <Key label="0" onPress={() => onKeyPress('0')} />
        <Key label="." onPress={() => onKeyPress('.')} />
        <Key label="⌫" tone="danger" onPress={onBackspace} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f0eef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyActive: {
    backgroundColor: '#d6f3ee',
    borderWidth: 1.5,
    borderColor: brand.gradientEnd,
  },
  keyWarning: {
    backgroundColor: '#fbf1de',
  },
  keyDanger: {
    backgroundColor: '#fde3dc',
  },
  keyPressed: {
    backgroundColor: brand.gradientEnd,
  },
  keyText: {
    fontSize: 16,
    fontWeight: '600',
    color: brand.textDark,
  },
  keyTextActive: {
    color: brand.gradientEnd,
  },
  keyTextPressed: {
    color: '#ffffff',
  },
});
