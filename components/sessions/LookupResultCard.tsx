import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getApiBase } from '../../constants/api'
import { Colors } from '../../constants/colors'
import { photoUri } from '../onec/inventory'
import type { LookupResult } from './types'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) : null

interface Props {
  result:  LookupResult
  onReset: () => void
}

export default function LookupResultCard({ result, onReset }: Props) {
  const [lightbox, setLightbox] = useState(false)
  // photoPath — наш бэкенд (относительный URL); photoKey — легаси, оставлен на всякий случай
  const photo = photoUri(result.photoPath)
    ?? (result.photoKey ? `${getApiBase()}/photos/${result.photoKey}` : null)

  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'Инв. номер',    value: result.inventoryNumber },
    ...(result.barcode           ? [{ label: 'Штрих-код',     value: result.barcode }] : []),
    ...(result.assetFaType       ? [{ label: 'Вид ОС',        value: result.assetFaType }] : []),
    ...(result.factoryNumber     ? [{ label: 'Зав. номер',    value: result.factoryNumber }] : []),
    ...(result.location          ? [{ label: '📍 Кабинет',    value: result.location.name,          color: Colors.accent  }] : []),
    ...(result.employee          ? [{ label: '🧑‍💼 Сотрудник', value: result.employee.fullName,       color: Colors.accent2 }] : []),
    ...(result.responsiblePerson ? [{ label: '👔 МОЛ',        value: result.responsiblePerson.fullName }] : []),
    ...(result.organization      ? [{ label: '🏢 Организация', value: result.organization.name }] : []),
    ...(fmtDate(result.acceptanceDate) ? [{ label: 'Принят',  value: fmtDate(result.acceptanceDate)! }] : []),
  ]

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={3}>{result.name}</Text>
        <TouchableOpacity onPress={onReset} style={styles.resetBtn}>
          <Text style={styles.resetIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {photo && (
        <TouchableOpacity activeOpacity={0.85} onPress={() => setLightbox(true)}>
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
          <View style={styles.zoomHint}>
            <Feather name="maximize-2" size={11} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {rows.map(row => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.color ? { color: row.color } : null]} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}

      {/* Полноэкранный просмотр фото */}
      <Modal visible={lightbox} animationType="fade" transparent onRequestClose={() => setLightbox(false)}>
        <TouchableOpacity
          style={styles.lightbox}
          activeOpacity={1}
          onPress={() => setLightbox(false)}
        >
          {!!photo && (
            <Image source={{ uri: photo }} style={styles.lightboxImg} resizeMode="contain" />
          )}
          <View style={styles.lightboxClose}>
            <Feather name="x" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: '#2d6a45', padding: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  name:     { fontSize: 16, fontWeight: '700', color: Colors.text1, flex: 1 },
  resetBtn: { padding: 4, marginLeft: 8 },
  resetIcon: { fontSize: 18, color: Colors.text3 },
  // contain + белый фон — фото 1С обычно на белом, cover их обрезал
  photo: {
    width: '100%', height: 200, borderRadius: 10,
    marginBottom: 12, backgroundColor: '#fff',
  },
  zoomHint: {
    position: 'absolute', right: 8, bottom: 20,
    backgroundColor: 'rgba(2,6,23,0.55)', borderRadius: 8, padding: 6,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: Colors.bg3,
  },
  label: { fontSize: 12, color: Colors.text3, flexShrink: 0, marginRight: 8 },
  value: { fontSize: 13, color: Colors.text1, fontWeight: '600', flex: 1, textAlign: 'right' },

  lightbox: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  lightboxImg: { width: '100%', height: '85%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 9999, padding: 10,
  },
})
