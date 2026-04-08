// components/session/SessionHeader.tsx

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import type { SessionDetail } from './types'

interface Props {
  session:   SessionDetail
  onBack:    () => void
  onRefresh: () => void
}

export default function SessionHeader({ session, onBack, onRefresh }: Props) {
  return (
    <>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{session.name}</Text>
          <Text style={styles.sub}>📍 {session.location} · {session.total} ОС</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Статистика */}
      <View style={styles.statsRow}>
        {([
          { label: 'Всего', value: session.total,     color: Colors.text2   },
          { label: '✅',    value: session.found,     color: Colors.accent2 },
          { label: '❌',    value: session.notFound,  color: Colors.danger  },
          { label: '⚠️',   value: session.misplaced, color: Colors.warn    },
          { label: '⏳',   value: session.pending,   color: Colors.text3   },
        ]).map(s => (
          <View key={s.label} style={styles.statBox}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { padding: 4 },
  backText:    { fontSize: 24, color: Colors.accent },
  title:       { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  sub:         { fontSize: 11, color: Colors.text3, marginTop: 2 },
  refreshBtn:  { padding: 8 },
  refreshText: { fontSize: 18 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statBox:   { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, color: Colors.text3, marginTop: 2 },
})