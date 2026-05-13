import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modern admin confirm dialog. Use for destructive/high-impact actions.
 * The lighter ActionSheet (showSheet) is preferred for normal confirms;
 * this one is bigger and centered for serious actions like delete/ban/end-stream.
 */
export function ConfirmDialog({
  visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive, loading, onConfirm, onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <View style={[s.iconWrap, destructive && s.iconWrapDestructive]}>
            <Ionicons
              name={destructive ? 'warning' : 'help-circle'}
              size={28}
              color={destructive ? '#FF453A' : Colors.primary}
            />
          </View>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}

          <View style={s.actions}>
            <TouchableOpacity style={s.cancel} onPress={onCancel} disabled={loading}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirm, destructive && s.confirmDestructive]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  dialog: {
    width: '100%', backgroundColor: Colors.card, borderRadius: 22, padding: 22, gap: 10,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(214,26,78,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  iconWrapDestructive: { backgroundColor: 'rgba(255,69,58,0.12)' },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  message: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  cancel: { flex: 1, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  confirm: { flex: 1, height: 46, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmDestructive: { backgroundColor: '#FF453A' },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
