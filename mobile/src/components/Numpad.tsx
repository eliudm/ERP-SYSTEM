import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { brand } from '../theme';

const KEYS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['+/-', '0', '.'],
];

interface NumpadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
}

// Odoo-style numpad: tap a cart line to select it, then type a value here
// to set its quantity/price directly instead of repeated +/- taps.
export const Numpad: React.FC<NumpadProps> = ({ onKeyPress, onBackspace }) => {
  return (
    <View style={styles.grid}>
      {KEYS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
              ]}
              onPress={() => onKeyPress(key)}
            >
              {({ pressed }) => (
                <Text
                  style={[styles.keyText, pressed && styles.keyTextPressed]}
                >
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.key,
            styles.keyWide,
            pressed && styles.keyPressed,
          ]}
          onPress={onBackspace}
        >
          {({ pressed }) => (
            <Text style={[styles.keyText, pressed && styles.keyTextPressed]}>
              ⌫
            </Text>
          )}
        </Pressable>
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
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0eef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: {
    flex: 3,
  },
  keyPressed: {
    backgroundColor: brand.gradientEnd,
  },
  keyText: {
    fontSize: 17,
    fontWeight: '600',
    color: brand.textDark,
  },
  keyTextPressed: {
    color: '#ffffff',
  },
});
