import { Redirect, Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useSheet } from '@/components/GlobalActionSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { default: IoniconName; active: IoniconName }> = {
  index:   { default: 'grid-outline',          active: 'grid' },
  users:   { default: 'people-outline',        active: 'people' },
  posts:   { default: 'document-text-outline', active: 'document-text' },
  streams: { default: 'videocam-outline',      active: 'videocam' },
};

const TAB_LABELS: Record<string, string> = {
  index:   'Dashboard',
  users:   'Users',
  posts:   'Posts',
  streams: 'Streams',
};

// Tabs shown in the bottom bar — last slot is a "More" button (not a real route).
const VISIBLE_TABS = ['index', 'users', 'posts', 'streams'] as const;

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.05 : 0.92, damping: 12, stiffness: 220, useNativeDriver: true }).start();
  }, [focused]);

  const icons = TAB_ICONS[name];
  const iconName = icons ? (focused ? icons.active : icons.default) : 'ellipse-outline';

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
      {focused && (
        <LinearGradient
          colors={Gradients.primary}
          style={styles.activeIndicator}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
      )}
      <View style={styles.iconWrapper}>
        <Ionicons name={iconName} size={23} color={focused ? Colors.primary : Colors.textMuted} />
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>
        {TAB_LABELS[name]}
      </Text>
    </Animated.View>
  );
}

function MoreTabIcon() {
  return (
    <View style={styles.tabItem}>
      <View style={styles.iconWrapper}>
        <Ionicons name="ellipsis-horizontal" size={23} color={Colors.textMuted} />
      </View>
      <Text style={styles.label}>More</Text>
    </View>
  );
}

export default function AdminLayout() {
  const user = useAuthStore(s => s.user);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showSheet = useSheet();

  if (!user) return <Redirect href="/auth/login" />;
  if (!user.isAdmin) return <Redirect href="/(tabs)/home" />;

  const openMoreSheet = () => {
    Haptics.selectionAsync();
    showSheet({
      title: 'More',
      options: [
        { label: 'Wallet & Transactions', onPress: () => router.push('/admin/wallet') },
        { label: 'Reports Queue',         onPress: () => router.push('/admin/reports') },
        { label: 'System Settings',       onPress: () => router.push('/admin/system') },
        { label: 'Audit Log',             onPress: () => router.push('/admin/audit') },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.tabBarInner}>
            {VISIBLE_TABS.map((name) => {
              const routeIndex = state.routes.findIndex(r => r.name === name);
              if (routeIndex < 0) return null;
              const route = state.routes[routeIndex];
              const focused = state.index === routeIndex;
              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  style={{ flex: 1 }}
                  activeOpacity={1}
                >
                  <TabBarIcon name={name} focused={focused} />
                </TouchableOpacity>
              );
            })}
            {/* More — opens a sheet with the remaining sections */}
            <TouchableOpacity
              onPress={openMoreSheet}
              style={{ flex: 1 }}
              activeOpacity={1}
            >
              <MoreTabIcon />
            </TouchableOpacity>
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="users" />
      <Tabs.Screen name="posts" />
      <Tabs.Screen name="streams" />
      <Tabs.Screen name="wallet"   options={{ href: null }} />
      <Tabs.Screen name="reports"  options={{ href: null }} />
      <Tabs.Screen name="system"   options={{ href: null }} />
      <Tabs.Screen name="audit"    options={{ href: null }} />
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
      <Tabs.Screen name="watch/[id]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
  },
  tabBarInner: { flexDirection: 'row', paddingTop: 8 },
  tabItem: { alignItems: 'center', gap: 4, paddingVertical: 4, position: 'relative' },
  activeIndicator: { position: 'absolute', top: -8, left: '25%', right: '25%', height: 3, borderRadius: 2 },
  iconWrapper: { position: 'relative' },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  labelActive: { color: Colors.textPrimary, fontWeight: '700' },
});
