// components/scan/HistoryScreen.tsx

import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import { statusColor, statusEmoji } from './scanHelpers'
import type { HistoryItem } from './types'

interface Props {
  history: HistoryItem[]
  onBack:  () => void
  onClear: () => void
}

export default function HistoryScreen({ history, onBack, onClear }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>История сканирования</Text>
          <Text style={styles.sub}>{history.length} записей</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Очистить</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={history}
        // ← index как запасной ключ на случай дубля
        keyExtractor={(item, index) => item.id ?? `history-${index}`}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>История пуста</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            key={`${item.id}-${index}`}   // ← дополнительная защита на уровне View
            style={[styles.card, { borderLeftColor: statusColor(item.status), borderLeftWidth: 3 }]}
          >
            <View style={styles.row}>
              <Text style={styles.emoji}>{statusEmoji(item.status)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.barcode}>{item.barcode}</Text>
              </View>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:   { padding: 4 },
  backText:  { fontSize: 24, color: Colors.accent },
  title:     { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  sub:       { fontSize: 11, color: Colors.text3, marginTop: 2 },
  clearBtn:  { padding: 8 },
  clearText: { fontSize: 12, color: Colors.danger },
  card: {
    backgroundColor: Colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji:   { fontSize: 20 },
  name:    { fontSize: 13, color: Colors.text1, fontWeight: '500' },
  barcode: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginTop: 2 },
  time:    { fontSize: 11, color: Colors.text3 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: Colors.text3 },
})