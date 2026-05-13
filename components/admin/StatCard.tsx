import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  accent?: string; // tailwind-ish color tint for the icon
  trend?: string; // e.g. "+12 today"
  onPress?: () => void;
}

export function StatCard({ icon, label, value, accent = Colors.primary, trend, onPress }: Props) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={s.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <LinearGradient
        colors={[`${accent}28`, `${accent}08`]}
        style={s.iconWrap}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icon} size={20} color={accent} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
        {trend ? <Text style={[s.trend, { color: accent }]}>{trend}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /> : null}
    </Container>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  value: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 2, letterSpacing: -0.4 },
  trend: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
