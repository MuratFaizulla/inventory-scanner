// components/session/SessionItemCard.tsx

import { Feather } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
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
  d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''

// Код (инв. № / штрих-код) с копированием одним нажатием
function CopyCode({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await Clipboard.setStringAsync(value)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <TouchableOpacity style={styles.codeChip} onPress={copy} activeOpacity={0.6}>
      <Feather name={icon} size={11} color={Colors.text3} />
      <Text style={styles.codeText}>{value}</Text>
      <Feather
        name={copied ? 'check' : 'copy'}
        size={12}
        color={copied ? Colors.accent2 : Colors.text3}
      />
    </TouchableOpacity>
  )
}

export default function SessionItemCard({ item, cancelling, onRelocate, onCancel }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: statusBorderColor(item.status) }]}>
      <Text style={styles.name} numberOfLines={2}>{item.asset.name}</Text>

      {/* Коды — тап копирует */}
      <View style={styles.codesRow}>
        {item.asset.inventoryNumber !== '—' && (
          <CopyCode icon="hash" value={item.asset.inventoryNumber} />
        )}
        {!!item.asset.barcode && (
          <CopyCode icon="credit-card" value={item.asset.barcode} />
        )}
      </View>

      <View style={styles.infoBlock}>
        <InfoRow icon="map-pin" value={item.asset.location.name} />
        <InfoRow icon="user" value={item.asset.responsiblePerson.fullName} />
        {item.asset.employee && item.asset.employee.fullName !== '—' && (
          <InfoRow icon="users" value={item.asset.employee.fullName} />
        )}
      </View>

      {!!item.note && (
        <View style={styles.noteBox}>
          <Feather name="edit-3" size={11} color={Colors.warn} />
          <Text style={styles.note}>{item.note}</Text>
        </View>
      )}

      {(item.scannedBy || item.scannedAt) && (
        <View style={styles.footer}>
          <Feather name="check-circle" size={11} color={Colors.text3} />
          <Text style={styles.scannedBy}>
            {[item.scannedBy, fmtTime(item.scannedAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}

      {item.status !== 'PENDING' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => onRelocate(item)}>
            <Feather name="edit-2" size={12} color={Colors.accent} />
            <Text style={styles.editBtnText}>Изменить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(item)}
            disabled={cancelling === item.id}
          >
            <Feather name="x" size={12} color={Colors.danger} />
            <Text style={styles.cancelBtnText}>
              {cancelling === item.id ? '...' : 'Отменить'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Строка иконка + значение ──────────────────────────────────────────────────
function InfoRow({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Feather name={icon} size={12} color={Colors.text3} style={{ marginTop: 1 }} />
      <Text style={infoStyles.value} numberOfLines={2}>{value}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'flex-start' },
  value: { fontSize: 12, color: Colors.text2, flex: 1 },
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, padding: 14,
  },
  name: { fontSize: 13, fontWeight: '600', color: Colors.text1, marginBottom: 8 },

  codesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  codeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg3, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  codeText: { fontSize: 11, color: Colors.text2, fontVariant: ['tabular-nums'] },

  infoBlock: { gap: 0 },

  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(250,204,21,0.08)', borderRadius: 8,
    padding: 8, marginTop: 6,
  },
  note: { fontSize: 11, color: Colors.warn, flex: 1, lineHeight: 15 },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
  },
  scannedBy: { fontSize: 11, color: Colors.text3 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: '#0c2a4a', borderRadius: 8,
    padding: 10,
    borderWidth: 1, borderColor: '#1e4a7a',
  },
  editBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: '#2a0a0a', borderRadius: 8,
    padding: 10,
    borderWidth: 1, borderColor: '#4a1a1a',
  },
  cancelBtnText: { color: Colors.danger, fontSize: 12, fontWeight: '600' },
})
