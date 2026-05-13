import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useEffect } from 'react';
import { Colors, Gradients } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { useChatStore } from '@/store/chatStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { default: IoniconName; active: IoniconName }> = {
  home:     { default: 'home-outline',        active: 'home' },
  discover: { default: 'people-outline',      active: 'people' },
  live:     { default: 'videocam-outline',    active: 'videocam' },
  messages: { default: 'chatbubbles-outline', active: 'chatbubbles' },
  profile:  { default: 'person-outline',      active: 'person' },
};

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  discover: 'Discover',
  live: 'Live',
  messages: 'Messages',
  profile: 'Profile',
};

function TabBarIcon({ name, focused, badgeCount }: { name: string; focused: boolean; badgeCount?: number }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.12, damping: 8, stiffness: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.spring(scale, { toValue: 0.92, damping: 12, useNativeDriver: true }).start();
    }
  }, [focused]);

  const icons = TAB_ICONS[name];
  const iconName = icons ? (focused ? icons.active : icons.default) : 'ellipse-outline';

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
      {focused && (
        <LinearGradient
          colors={Gradients.primary}
          style={styles.activeIndicator}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      )}
      <View style={styles.iconWrapper}>
        <Ionicons
          name={iconName}
          size={23}
          color={focused ? Colors.primary : Colors.textMuted}
        />
        {badgeCount ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>
        {TAB_LABELS[name]}
      </Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { conversations } = useChatStore();
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, descriptors, navigation }) => (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.tabBarInner}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const badge = route.name === 'messages' ? unreadTotal : undefined;

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  }}
                  style={{ flex: 1 }}
                  activeOpacity={1}
                >
                  <TabBarIcon name={route.name} focused={focused} badgeCount={badge} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="live" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    left: '25%',
    right: '25%',
    height: 3,
    borderRadius: 2,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});