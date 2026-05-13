import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { reportService, REPORT_REASONS, ReportTargetType } from '@/services/reportService';
import { useSheet } from '@/components/GlobalActionSheet';

interface Props {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string; // e.g. "Shane's post"
  onClose: () => void;
}

/**
 * Modal that lets a regular user file a report against a post, user, stream, or comment.
 * Pick a reason → optionally add a note → submit.
 */
export function ReportSheet({ visible, targetType, targetId, targetLabel, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showSheet = useSheet();

  React.useEffect(() => {
    if (!visible) {
      setReason(null);
      setNote('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const fullReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    try {
      await reportService.submitReport(targetType, targetId, fullReason);
      onClose();
      showSheet({
        title: 'Report Submitted',
        message: 'Thanks. Our moderation team will review it shortly.',
        options: [{ label: 'OK' }],
      });
    } catch (e: any) {
      showSheet({ title: 'Could not submit', message: e.message, options: [{ label: 'OK' }] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <SafeAreaView edges={['bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.handle} />

              <View style={s.header}>
                <View style={s.iconWrap}>
                  <Ionicons name="flag" size={22} color="#FF9F0A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Report{targetLabel ? ` ${targetLabel}` : ''}</Text>
                  <Text style={s.subtitle}>Why are you reporting this?</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={s.reasonsList}>
                  {REPORT_REASONS.map(r => {
                    const selected = reason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[s.reasonRow, selected && s.reasonRowSelected]}
                        onPress={() => setReason(r)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.reasonText, selected && s.reasonTextSelected]}>{r}</Text>
                        {selected && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {reason ? (
                  <View style={s.noteSection}>
                    <Text style={s.noteLabel}>Additional details (optional)</Text>
                    <TextInput
                      style={s.noteInput}
                      placeholder="Anything else our team should know..."
                      placeholderTextColor={Colors.textMuted}
                      value={note}
                      onChangeText={setNote}
                      multiline
                      maxLength={300}
                    />
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity
                style={[s.submitBtn, (!reason || submitting) && s.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!reason || submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="paper-plane" size={16} color="#fff" />
                      <Text style={s.submitText}>Submit Report</Text>
                    </>}
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,159,10,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

  reasonsList: { gap: 6 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent' },
  reasonRowSelected: { backgroundColor: 'rgba(214,26,78,0.12)', borderColor: 'rgba(214,26,78,0.35)' },
  reasonText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  reasonTextSelected: { color: Colors.primary, fontWeight: '800' },

  noteSection: { marginTop: 14, gap: 6 },
  noteLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  noteInput: { minHeight: 72, maxHeight: 120, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: 14, backgroundColor: Colors.primary, marginTop: 14, marginBottom: 8 },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
