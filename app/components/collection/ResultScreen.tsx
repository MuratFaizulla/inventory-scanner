import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import type { PendingContext, ScanResult, ScanStatus } from './types'
import { STATUS_CFG } from './types'

interface Props {
  result:         ScanResult | null
  context:        PendingContext | null
  error:          string | null
  errorNotIn:     boolean
  submitting:     boolean
  onNext:         () => void
  onNextManual:   () => void
  onChangeStatus: (s: ScanStatus) => void
}

export default function ResultScreen({
  result, context, error, errorNotIn, submitting, onNext, onNextManual, onChangeStatus,
}: Props) {

  // ── Ошибка ──
  if (!result) return (
    <View style={{ flex: 1 }}>
      <View style={[styles.statusBox, { backgroundColor: errorNotIn ? '#1c1a0444' : '#450a0a44' }]}>
        <Text style={styles.statusEmoji}>{errorNotIn ? '⚠️' : '❌'}</Text>
        <Text style={[styles.statusLabel, { color: errorNotIn ? Colors.warn : Colors.danger }]}>
          {errorNotIn ? 'Не в этой сессии' : 'Не найден'}
        </Text>
        {error && <Text style={styles.errorMsg}>{error}</Text>}
      </View>
      <View style={styles.nextRow}>
        <TouchableOpacity style={styles.manualBtn} onPress={onNextManual}>
          <Text style={styles.manualBtnText}>⌨️ Ввести</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextBtnText}>📷 Сканировать</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const status = result.alreadyScanned ? 'ALREADY' : result.item.status as ScanStatus
  const cfg    = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.RETURNED
  const { asset } = result
  const hasContext = context && (context.employeePending.length > 0 || context.locationPendingCount > 0)

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>

      {/* ── Статус ── */}
      <View style={[styles.statusBox, { backgroundColor: cfg.bg + '66', borderColor: cfg.border, borderWidth: 1 }]}>
        <Text style={styles.statusEmoji}>{cfg.emoji}</Text>
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        {result.alreadyScanned && result.previousStatus && (
          <Text style={styles.alreadyHint}>Ранее: {result.previousStatus}</Text>
        )}
      </View>

      {/* ── Карточка ОС ── */}
      <View style={styles.card}>
        <Text style={styles.assetName}>{asset.name}</Text>
        <Text style={styles.assetInv}>{asset.inventoryNumber}</Text>
        {asset.barcode && <Text style={styles.assetBarcode}>📊 {asset.barcode}</Text>}
        <View style={styles.divider} />
        {asset.location          && <InfoRow label="📍 Кабинет"   value={asset.location.name}             color={Colors.accent}  />}
        {asset.employee          && <InfoRow label="🧑‍💼 Сотрудник" value={asset.employee.fullName}         color={Colors.accent2} />}
        {asset.responsiblePerson && <InfoRow label="👔 МОЛ"        value={asset.responsiblePerson.fullName} />}
      </View>

      {/* ── Изменить статус ── */}
      {!result.alreadyScanned && (
        <View style={styles.changeRow}>
          <Text style={styles.changeLabel}>Изменить статус:</Text>
          <View style={styles.changeBtns}>
            {(['RETURNED', 'DAMAGED', 'LOST'] as ScanStatus[]).map(s => {
              const c      = STATUS_CFG[s]
              const active = result.item.status === s
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.changeBtn,
                    active ? { backgroundColor: c.bg, borderColor: c.border } : { backgroundColor: Colors.bg3, borderColor: Colors.border },
                    submitting && { opacity: 0.5 },
                  ]}
                  onPress={() => !active && onChangeStatus(s)}
                  disabled={submitting || active}
                >
                  <Text style={[styles.changeBtnText, { color: active ? c.color : Colors.text3 }]}>
                    {c.emoji} {c.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {/* ── Контекст ── */}
      {hasContext && (
        <View style={styles.contextBox}>
          {context!.employeePending.length > 0 && (
            <View style={styles.contextSection}>
              <View style={styles.contextHead}>
                <Text style={styles.contextHeadText}>
                  ⏳ У {context!.employeeName?.split(' ')[0]} ещё не сдано
                </Text>
                <View style={styles.contextBadge}>
                  <Text style={styles.contextBadgeText}>{context!.employeePending.length}</Text>
                </View>
              </View>
              {context!.employeePending.slice(0, 5).map((p, i) => (
                <View key={i} style={styles.pendingRow}>
                  <Text style={styles.pendingDot}>•</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.pendingInv}>{p.inventoryNumber}</Text>
                  </View>
                </View>
              ))}
              {context!.employeePending.length > 5 && (
                <Text style={styles.pendingMore}>+ ещё {context!.employeePending.length - 5}...</Text>
              )}
            </View>
          )}

          {context!.employeePending.length > 0 && context!.locationPendingCount > 0 && (
            <View style={styles.contextDivider} />
          )}

          {context!.locationPendingCount > 0 && (
            <View style={styles.contextSection}>
              <View style={styles.contextHead}>
                <Text style={styles.contextHeadText} numberOfLines={1}>
                  📍 В {context!.locationName} осталось
                </Text>
                <View style={[styles.contextBadge, { backgroundColor: '#0c2a4a', borderColor: Colors.accent }]}>
                  <Text style={[styles.contextBadgeText, { color: Colors.accent }]}>
                    {context!.locationPendingCount}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Кнопки продолжения ── */}
      <View style={styles.nextRow}>
        <TouchableOpacity style={styles.manualBtn} onPress={onNextManual}>
          <Text style={styles.manualBtnText}>⌨️ Ввести</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextBtnText}>📷 Следующий</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
      <Text style={{ fontSize: 12, color: Colors.text3, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: color ?? Colors.text1, fontWeight: '500', flex: 2, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },

  statusBox: {
    alignItems: 'center', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: 'transparent',
  },
  statusEmoji: { fontSize: 52, marginBottom: 8 },
  statusLabel: { fontSize: 22, fontWeight: '800' },
  alreadyHint: { fontSize: 12, color: Colors.text3, marginTop: 6 },
  errorMsg:    { fontSize: 13, color: Colors.text2, marginTop: 8, textAlign: 'center' },

  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  assetName:    { fontSize: 16, fontWeight: '700', color: Colors.text1, marginBottom: 4 },
  assetInv:     { fontSize: 12, color: Colors.text3, fontFamily: 'monospace', marginBottom: 4 },
  assetBarcode: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 14 },
  divider:      { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  changeRow:   { gap: 8 },
  changeLabel: { fontSize: 12, color: Colors.text3, fontWeight: '600' },
  changeBtns:  { flexDirection: 'row', gap: 8 },
  changeBtn: {
    flex: 1, borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1,
  },
  changeBtnText: { fontSize: 12, fontWeight: '700' },

  contextBox: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  contextSection:   { padding: 14 },
  contextHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  contextHeadText:  { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text1 },
  contextBadge: {
    backgroundColor: '#2a1a04', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.warn,
  },
  contextBadgeText: { fontSize: 13, fontWeight: '800', color: Colors.warn },
  contextDivider:   { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
  pendingRow:       { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pendingDot:       { color: Colors.danger, fontSize: 14, marginTop: 1 },
  pendingName:      { fontSize: 13, color: Colors.text1, fontWeight: '500' },
  pendingInv:       { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginTop: 1 },
  pendingMore:      { fontSize: 12, color: Colors.text3 },

  nextRow:      { flexDirection: 'row', gap: 10 },
  manualBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  manualBtnText: { color: Colors.text2, fontWeight: '600', fontSize: 14 },
  nextBtn: {
    flex: 2, backgroundColor: '#0c4a2a', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  nextBtnText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
})
