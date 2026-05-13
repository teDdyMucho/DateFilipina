import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { User } from '@/constants/types';

interface Props {
  user: User;
  onPress: () => void;
}

export function UserRow({ user, onPress }: Props) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Image source={{ uri: user.avatar }} style={s.avatar} contentFit="cover" />
        {user.isOnline && <View style={s.onlineDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{user.name}</Text>
          {user.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />}
          {user.isAdmin && (
            <View style={s.badge}>
              <Ionicons name="shield" size={10} color="#fff" />
              <Text style={s.badgeText}>ADMIN</Text>
            </View>
          )}
        </View>
        <View style={s.metaRow}>
          {user.location ? (
            <Text style={s.meta} numberOfLines={1}>
              <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
              {' '}{user.location}
            </Text>
          ) : <Text style={s.meta}>—</Text>}
          <Text style={s.metaDot}>·</Text>
          <Text style={s.meta}>{user.age} yrs</Text>
        </View>
        <View style={s.statsRow}>
          <Text style={s.stat}>{user.followers} followers</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.stat}>{user.coins.toLocaleString()} coins</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {user.isBanned ? (
          <View style={[s.statusPill, s.banned]}>
            <Ionicons name="ban" size={10} color="#fff" />
            <Text style={s.statusText}>BANNED</Text>
          </View>
        ) : (
          <View style={[s.statusPill, s.active]}>
            <Text style={s.statusText}>ACTIVE</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#222' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759', borderWidth: 2, borderColor: Colors.card },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: Colors.textMuted, fontSize: 12, flexShrink: 1 },
  metaDot: { color: Colors.textMuted, fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stat: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  banned: { backgroundColor: '#FF453A' },
  active: { backgroundColor: 'rgba(52,199,89,0.18)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.4)' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});
