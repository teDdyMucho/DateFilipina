import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function AdminAuditScreen() {
  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}><Text style={s.title}>Audit Log</Text></View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.placeholder}>
          <Ionicons name="list-outline" size={48} color={Colors.textMuted} />
          <Text style={s.phTitle}>Audit Log</Text>
          <Text style={s.phText}>Phase 9 — last phase.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { padding: 20 },
  placeholder: { alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder, gap: 6, marginTop: 40 },
  phTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 6 },
  phText: { color: Colors.textMuted, fontSize: 13 },
});
