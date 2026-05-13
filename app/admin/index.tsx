import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useSheet } from '@/components/GlobalActionSheet';
import { StatCard } from '@/components/admin/StatCard';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useLogout();
  const showSheet = useSheet();

  if (!user) return <Redirect href="/auth/login" />;
  if (!user.isAdmin) return <Redirect href="/(tabs)/home" />;

  const handleSignOut = () => {
    showSheet({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      options: [
        { label: 'Sign Out', destructive: true, onPress: logout },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView edges={['top']} style={s.headerWrap}>
        <LinearGradient
          colors={['rgba(214,26,78,0.18)', 'transparent']}
          style={s.headerGrad}
        />
        <View style={s.header}>
          <View style={s.titleRow}>
            <View style={s.shieldWrap}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Admin Panel</Text>
              <Text style={s.subtitle}>Signed in as {user.name}</Text>
            </View>
            <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>OVERVIEW</Text>

        <View style={s.grid}>
          <StatCard icon="people-outline" label="Total Users" value="—" accent="#0A84FF" onPress={() => router.push('/admin/users')} />
          <StatCard icon="document-text-outline" label="Total Posts" value="—" accent="#34C759" onPress={() => router.push('/admin/posts')} />
          <StatCard icon="videocam-outline" label="Live Streams" value="—" accent="#FF453A" onPress={() => router.push('/admin/streams')} />
          <StatCard icon="flag-outline" label="Pending Reports" value="—" accent="#FF9F0A" onPress={() => router.push('/admin/reports')} />
        </View>

        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.actions}>
          <StatCard icon="wallet-outline" label="Wallet & Transactions" value="Manage coin grants and refunds" accent="#FFD60A" onPress={() => router.push('/admin/wallet')} />
          <StatCard icon="settings-outline" label="System Settings" value="Maintenance, announcements, more" accent="#BF5AF2" onPress={() => router.push('/admin/system')} />
          <StatCard icon="list-outline" label="Audit Log" value="Every admin action recorded" accent="#5E5CE6" onPress={() => router.push('/admin/audit')} />
        </View>

        <View style={s.placeholderBox}>
          <Ionicons name="construct-outline" size={36} color={Colors.textMuted} />
          <Text style={s.placeholderTitle}>Dashboard stats coming soon</Text>
          <Text style={s.placeholderText}>
            Real-time counts and charts will appear here once Phase 7 (Analytics) is built.
            Use the bottom tabs or tap a card to jump to a section.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headerWrap: { backgroundColor: Colors.background },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  signOutBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 30, gap: 8 },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginLeft: 4, marginTop: 8, marginBottom: 6 },
  grid: { gap: 8 },
  actions: { gap: 8 },

  placeholderBox: { alignItems: 'center', padding: 28, marginTop: 16, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder, gap: 8 },
  placeholderTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  placeholderText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
