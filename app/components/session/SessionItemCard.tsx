// components/session/SessionItemCard.tsx

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import type { Item } from './types'

interface Props {
  item:       Item
  cancelling: number | null
  onRelocate: (item: Item) => void
  onCancel:   (item: Item) => void
}

const statusBorderColor = (status: string) => {
  if (status === 'FOUND')     return Colors.accent2
  if (status === 'NOT_FOUND') return Colors.danger
  if (status === 'MISPLACED') return Colors.warn
  return Colors.border
}

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'

export default function SessionItemCard({ item, cancelling, onRelocate, onCancel }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: statusBorderColor(item.status) }]}>
      <Text style={styles.name} numberOfLines={2}>{item.asset.name}</Text>
      <Text style={styles.inv}>{item.asset.inventoryNumber}</Text>
      {item.asset.barcode && <Text style={styles.barcode}>📊 {item.asset.barcode}</Text>}

      <View style={styles.divider} />

      <InfoRow icon="📍" value={item.asset.location.name} />
      <InfoRow icon="👤" value={item.asset.responsiblePerson.fullName} />
      {item.asset.employee && <InfoRow icon="🧑‍💼" value={item.asset.employee.fullName} />}
      {item.note && <Text style={styles.note}>{item.note}</Text>}

      <View style={styles.footer}>
        {item.scannedBy
          ? <Text style={styles.scannedBy}>🔍 {item.scannedBy}</Text>
          : <View />
        }
        <Text style={styles.scannedAt}>{fmtTime(item.scannedAt)}</Text>
      </View>

      {item.status !== 'PENDING' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => onRelocate(item)}>
            <Text style={styles.editBtnText}>✏️ Изменить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(item)}
            disabled={cancelling === item.id}
          >
            <Text style={styles.cancelBtnText}>
              {cancelling === item.id ? '...' : '✕ Отменить'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Строка иконка + значение ──────────────────────────────────────────────────
function InfoRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.icon}>{icon}</Text>
      <Text style={infoStyles.value} numberOfLines={2}>{value}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 6, marginBottom: 4 },
  icon:  { fontSize: 12, width: 18 },
  value: { fontSize: 12, color: Colors.text2, flex: 1 },
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, padding: 14,
  },
  name:    { fontSize: 13, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
  inv:     { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 2 },
  barcode: { fontSize: 11, color: Colors.text3, marginBottom: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  note:    { fontSize: 11, color: Colors.warn, marginTop: 4 },
  footer:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scannedBy: { fontSize: 11, color: Colors.text3 },
  scannedAt: { fontSize: 11, color: Colors.text3 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: {
    flex: 1, backgroundColor: '#0c2a4a', borderRadius: 8,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#1e4a7a',
  },
  editBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    flex: 1, backgroundColor: '#2a0a0a', borderRadius: 8,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#4a1a1a',
  },
  cancelBtnText: { color: Colors.danger, fontSize: 12, fontWeight: '600' },
})