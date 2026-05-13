import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function BannedScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <LinearGradient
        colors={['rgba(255,69,58,0.18)', 'rgba(255,69,58,0.04)', 'transparent']}
        style={s.bgGrad}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.container}>
          <View style={s.iconWrap}>
            <Ionicons name="ban" size={48} color="#FF453A" />
          </View>
          <Text style={s.title}>Account Suspended</Text>
          <Text style={s.subtitle}>
            Your account has been suspended by an administrator.
          </Text>

          {reason ? (
            <View style={s.reasonBox}>
              <Text style={s.reasonLabel}>REASON</Text>
              <Text style={s.reasonText}>{reason}</Text>
            </View>
          ) : null}

          <View style={s.supportBox}>
            <Ionicons name="mail-outline" size={16} color={Colors.textMuted} />
            <Text style={s.supportText}>
              If you think this is a mistake, contact{' '}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>support@dateafilipina.app</Text>
            </Text>
          </View>

          <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/auth/login')} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={s.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,69,58,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,69,58,0.40)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  reasonBox: {
    width: '100%', padding: 14, marginTop: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)',
    gap: 4,
  },
  reasonLabel: { color: '#FF453A', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  reasonText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  supportBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 8,
  },
  supportText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    marginTop: 14,
  },
  backText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
