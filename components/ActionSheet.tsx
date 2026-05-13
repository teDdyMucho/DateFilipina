import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { Colors } from '@/constants/colors';

export type ActionSheetOption = {
  label: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
};

export function ActionSheet({ visible, title, options, onClose }: Props) {
  const normalOptions = options.filter(o => o.style !== 'cancel');
  const cancelOption = options.find(o => o.style === 'cancel');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={st.root}>
        {/* Tapping this area closes the sheet */}
        <TouchableOpacity style={st.backdrop} onPress={onClose} activeOpacity={1} />

        {/* Bottom sheet */}
        <View style={st.sheet}>
          {title ? (
            <View style={st.titleRow}>
              <Text style={st.title}>{title}</Text>
            </View>
          ) : null}

          <View style={st.group}>
            {normalOptions.map((opt, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <View style={st.sep} /> : null}
                <TouchableOpacity
                  style={st.option}
                  activeOpacity={0.6}
                  onPress={() => {
                    onClose();
                    setTimeout(() => opt.onPress?.(), 50);
                  }}
                >
                  <Text style={[st.optText, opt.style === 'destructive' && st.destructive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {cancelOption ? (
            <TouchableOpacity style={st.cancelBtn} activeOpacity={0.6} onPress={onClose}>
              <Text style={st.cancelText}>{cancelOption.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    padding: 10,
    paddingBottom: 30,
    gap: 10,
    backgroundColor: Colors.background,
  },
  titleRow: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  title: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  group: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  sep: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 16,
  },
  option: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '400',
  },
  destructive: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  cancelBtn: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cancelText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
});
