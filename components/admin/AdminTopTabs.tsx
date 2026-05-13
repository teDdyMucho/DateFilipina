import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface AdminTab {
  key: string;
  label: string;
  icon: IoniconName;
  href: string;
}

export const ADMIN_TABS: AdminTab[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline',          href: '/(tabs)/admin' },
  { key: 'users',     label: 'Users',     icon: 'people-outline',        href: '/admin/users' },
  { key: 'posts',     label: 'Posts',     icon: 'document-text-outline', href: '/admin/posts' },
  { key: 'streams',   label: 'Streams',   icon: 'videocam-outline',      href: '/admin/streams' },
  { key: 'wallet',    label: 'Wallet',    icon: 'wallet-outline',        href: '/admin/wallet' },
  { key: 'reports',   label: 'Reports',   icon: 'flag-outline',          href: '/admin/reports' },
  { key: 'system',    label: 'System',    icon: 'settings-outline',      href: '/admin/system' },
  { key: 'audit',     label: 'Audit',     icon: 'list-outline',          href: '/admin/audit' },
];

interface Props {
  active: string; // matches a tab.key
}

export function AdminTopTabs({ active }: Props) {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scroll}
      style={s.wrap}
    >
      {ADMIN_TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, isActive && s.tabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              if (!isActive) router.replace(tab.href as any);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={isActive ? '#fff' : Colors.textMuted}
            />
            <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  labelActive: { color: '#fff' },
});
