import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getApiBase } from '../../../constants/api'
import { Colors } from '../../../constants/colors'
import type { LookupResult } from './types'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) : null

interface Props {
  result:  LookupResult
  onReset: () => void
}

export default function LookupResultCard({ result, onReset }: Props) {
  const photoUri = result.photoKey
    ? `${getApiBase()}/photos/${result.photoKey}`
    : null

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

      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      )}

      {rows.map(row => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.color ? { color: row.color } : null]} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
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
  photo: {
    width: '100%', height: 200, borderRadius: 10,
    marginBottom: 12, backgroundColor: Colors.bg3,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: Colors.bg3,
  },
  label: { fontSize: 12, color: Colors.text3, flexShrink: 0, marginRight: 8 },
  value: { fontSize: 13, color: Colors.text1, fontWeight: '600', flex: 1, textAlign: 'right' },
})
