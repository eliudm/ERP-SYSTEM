import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { PosCategory } from '../../api/mobile.api';

const FALLBACK_COLORS = ['#1db8a0', '#6f67ff', '#f08c2f', '#2f80ed', '#e05297'];
const colorForCategory = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1)
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
};

// Lighten a hex color for a softer tile background (categories carry a
// brand/admin-configured color, but used at full saturation across a whole
// tile it reads too loud — this keeps the hue, softens it).
const tint = (hex: string, amount: number) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  const mix = (channel: string) => {
    const value = parseInt(channel, 16);
    const next = value + (255 - value) * amount;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

interface CategoryGridProps {
  categories: PosCategory[];
  onSelect: (categoryId: string) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  onSelect,
}) => (
  <View style={styles.grid}>
    {categories.map((cat) => {
      const base = cat.color || colorForCategory(cat.id);
      return (
        <Pressable
          key={cat.id}
          style={[styles.tile, { backgroundColor: tint(base, 0.78) }]}
          onPress={() => onSelect(cat.id)}
        >
          <Text style={[styles.tileText, { color: tint(base, -0.1) }]}>
            {cat.name}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  tile: {
    width: '47%',
    minHeight: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tileText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
