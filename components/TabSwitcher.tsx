import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface Tab {
  key: string;
  label: string;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  style?: ViewStyle;
}

export function TabSwitcher({ tabs, activeTab, onTabChange, style }: TabSwitcherProps) {
  const activeIndex = tabs.findIndex(t => t.key === activeTab);
  const translateX = useRef(new Animated.Value(activeIndex)).current;

  const handlePress = (key: string, index: number) => {
    Haptics.selectionAsync();
    Animated.spring(translateX, {
      toValue: index,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
    onTabChange(key);
  };

  const tabWidth = 100 / tabs.length;

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            width: `${tabWidth}%` as any,
            transform: [{
              translateX: translateX.interpolate({
                inputRange: tabs.map((_, i) => i),
                outputRange: tabs.map((_, i) => i * (100 / tabs.length) * 3.5),
              }),
            }],
          },
        ]}
      />
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, { width: `${tabWidth}%` }]}
          onPress={() => handlePress(tab.key, index)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.label,
            activeTab === tab.key && styles.activeLabel,
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: Colors.primary,
    borderRadius: 9,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  activeLabel: {
    color: '#fff',
  },
});
