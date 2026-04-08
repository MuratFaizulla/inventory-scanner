// components/scan/ScanResultCard.tsx

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import { statusBg, statusColor, statusEmoji, statusLabel } from './scanHelpers'
import type { ScanResult } from './types'

interface Props {
  result:        ScanResult
  cancelling:    boolean
  onNext:        () => void
  onNextManual:  () => void
  onRelocate:    () => void
  onCancelScan:  () => void
}

export default function ScanResultCard({
  result, cancelling, onNext, onNextManual, onRelocate, onCancelScan,
}: Props) {
  const { status, asset, expectedLocation, actualLocation, previousScan } = result

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>

      {/* ── Статус ── */}
      <View style={[styles.statusBox, { backgroundColor: statusBg(status) }]}>
        <Text style={styles.statusEmoji}>{statusEmoji(status)}</Text>
        <Text style={[styles.statusLabel, { color: statusColor(status) }]}>
          {statusLabel(status)}
        </Text>
        {status === 'ALREADY' && (
          <Text style={styles.alreadyHint}>Этот ОС уже был отсканирован ранее</Text>
        )}
      </View>

      {/* ── Карточка ОС ── */}
      {asset ? (
        <View style={styles.card}>
          <Text style={styles.assetName}>{asset.name}</Text>
          <Text style={styles.assetInv}>{asset.inventoryNumber}</Text>
          {asset.barcode && <Text style={styles.assetBarcode}>📊 {asset.barcode}</Text>}

          <View style={styles.divider} />
          <Row label="📍 Местонахождение" value={asset.location} />
          <Row label="👤 МОЛ"             value={asset.responsiblePerson} />
          {asset.employee && asset.employee !== '—' && (
            <Row label="🧑‍💼 Сотрудник" value={asset.employee} />
          )}

          {/* Не на месте */}
          {status === 'MISPLACED' && (
            <>
              <View style={styles.divider} />
              <Text style={styles.misplacedTitle}>⚠️ Не на своём месте</Text>
              <Row label="По базе числится" value={expectedLocation || '—'} valueColor={Colors.danger} />
              <Row label="Найден здесь"     value={actualLocation  || '—'} valueColor={Colors.warn} />
            </>
          )}

          {/* Предыдущее сканирование */}
          {status === 'ALREADY' && previousScan && (
            <>
              <View style={styles.divider} />
              <View style={styles.prevBlock}>
                <Text style={styles.prevTitle}>🔄 Данные первого сканирования</Text>
                {previousScan.scannedAt && (
                  <Row
                    label="🕐 Время"
                    value={new Date(previousScan.scannedAt).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  />
                )}
                {previousScan.scannedBy && <Row label="🖊️ Кто сканировал" value={previousScan.scannedBy} />}
                {previousScan.note      && <Row label="📝 Примечание"     value={previousScan.note} valueColor={Colors.warn} />}
              </View>
            </>
          )}

          {/* Действия */}
          {(status === 'FOUND' || status === 'MISPLACED' || status === 'ALREADY') && (
            <>
              <View style={styles.divider} />
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.relocateBtn} onPress={onRelocate}>
                  <Text style={styles.relocateBtnText}>✏️ Изменить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancelScan}
                  disabled={cancelling}
                >
                  <Text style={styles.cancelBtnText}>
                    {cancelling ? '...' : '✕ Отменить скан'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.notFoundText}>{result.message}</Text>
        </View>
      )}

      {/* ── Кнопки продолжения ── */}
      <View style={styles.nextRow}>
        <TouchableOpacity style={styles.manualNextBtn} onPress={onNextManual} activeOpacity={0.8}>
          <Text style={styles.manualNextText}>⌨️ Ввести</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={styles.nextBtnText}>📷 Сканировать</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ── Строка ключ-значение ──────────────────────────────────────────────────────
function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  label: { fontSize: 12, color: Colors.text3, flex: 1 },
  value: { fontSize: 13, color: Colors.text1, fontWeight: '500', flex: 2, textAlign: 'right' },
})

const styles = StyleSheet.create({
  container:     { padding: 20, gap: 16 },
  statusBox:     { alignItems: 'center', borderRadius: 16, padding: 24 },
  statusEmoji:   { fontSize: 48, marginBottom: 8 },
  statusLabel:   { fontSize: 20, fontWeight: '700' },
  alreadyHint:   { fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  assetName:    { fontSize: 15, fontWeight: '700', color: Colors.text1, marginBottom: 4 },
  assetInv:     { fontSize: 12, color: Colors.text3, fontFamily: 'monospace', marginBottom: 4 },
  assetBarcode: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 14 },
  divider:      { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  misplacedTitle: { fontSize: 13, fontWeight: '600', color: Colors.warn, marginBottom: 8 },
  notFoundText: { fontSize: 14, color: Colors.danger, textAlign: 'center', padding: 8 },
  prevBlock: {
    backgroundColor: '#1e3a5f22', borderRadius: 8,
    padding: 12, borderWidth: 1, borderColor: '#60a5fa44',
  },
  prevTitle: { fontSize: 12, fontWeight: '600', color: '#60a5fa', marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  relocateBtn: {
    flex: 1, backgroundColor: '#0c2a4a', borderRadius: 10,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e4a7a',
  },
  relocateBtnText: { color: Colors.accent, fontWeight: '600', fontSize: 13 },
  cancelBtn: {
    flex: 1, backgroundColor: '#2a0a0a', borderRadius: 10,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4a1a1a',
  },
  cancelBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 13 },
  nextRow: { flexDirection: 'row', gap: 10 },
  manualNextBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  manualNextText: { color: Colors.text2, fontWeight: '600', fontSize: 14 },
  nextBtn: {
    flex: 2, backgroundColor: '#0c4a2a', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#166534',
  },
  nextBtnText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
})