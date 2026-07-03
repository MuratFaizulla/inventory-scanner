import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
import type { HistoryEntry, SessionStats } from './types'

const STATUS_COLOR: Record<string, string> = {
  RETURNED: Colors.accent2,
  DAMAGED:  Colors.warn,
  LOST:     '#c084fc',
  ALREADY:  '#60a5fa',
}
const STATUS_EMOJI: Record<string, string> = {
  RETURNED: '✅', DAMAGED: '⚠️', LOST: '🔴', ALREADY: '🔄',
}

interface Props {
  history:      HistoryEntry[]
  stats:        SessionStats | null
  scannedCount: number
  onBack:       () => void
  onClear:      () => void
}

export default function CollectionHistoryScreen({ history, stats, scannedCount, onBack, onClear }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>История сканирования</Text>
          <Text style={styles.sub}>{history.length} записей · принято сейчас: {scannedCount}</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={onClear} style={{ padding: 8 }}>
            <Text style={{ fontSize: 12, color: Colors.danger }}>Очистить</Text>
          </TouchableOpacity>
        )}
      </View>

      {stats && (
        <View style={styles.statsBar}>
          <StatCell v={stats.returned} label="Сдали"      color={Colors.accent2} />
          <StatCell v={stats.damaged}  label="Повреждено" color={Colors.warn}    />
          <StatCell v={stats.lost}     label="Утеряно"    color="#c084fc"        />
          <StatCell v={stats.pending}  label="Не сдали"   color={Colors.danger}  />
        </View>
      )}

      <FlatList
        data={history}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 14, color: Colors.text3 }}>История пуста</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: STATUS_COLOR[item.status] ?? Colors.border }]}>
            <View style={styles.row}>
              <Text style={styles.emoji}>{STATUS_EMOJI[item.status] ?? '•'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.inv}>{item.inv}</Text>
              </View>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}

function StatCell({ v, label, color }: { v: number; label: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNum, { color }]}>{v}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:  { padding: 4 },
  backText: { fontSize: 24, color: Colors.accent },
  title:    { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  sub:      { fontSize: 11, color: Colors.text3, marginTop: 2 },

  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: Colors.text3, marginTop: 1, textAlign: 'center' },

  card: {
    backgroundColor: Colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, padding: 12,
  },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 20 },
  name:  { fontSize: 13, color: Colors.text1, fontWeight: '500' },
  inv:   { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginTop: 2 },
  time:  { fontSize: 11, color: Colors.text3 },
})
