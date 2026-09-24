// Плашка оффлайн-режима: нет связи / очередь / что сервер не принял.
// Когда всё отправлено и связь есть — не занимает места.
import { Feather } from '@expo/vector-icons'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { confirmDialog } from '../constants/dialog'
import { acts, useSyncState } from '../constants/act'

const KIND: Record<string, string> = { scan: 'Скан', update: 'Изменение', unscan: 'Отмена скана' }

const plural = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'операция'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'операции'
  : 'операций'

export default function SyncBanner() {
  const { online, syncing, queued, failed } = useSyncState()

  const showFailed = async () => {
    const lines = failed.slice(0, 8).map(f => `• ${KIND[f.kind]} ${f.code}: ${f.error}`)
    if (failed.length > 8) lines.push(`…и ещё ${failed.length - 8}`)
    const ok = await confirmDialog(
      'Сервер не принял',
      `${lines.join('\n')}\n\nПроверьте эти ОС вручную в деталях акта.`,
      'Понятно, убрать',
      { cancelText: 'Оставить' },
    )
    if (ok) await acts.sync.dismissFailed()
  }

  if (online && !queued && !failed.length) return null

  return (
    <View style={styles.wrap}>
      {(!online || queued > 0) && (
        <View style={[styles.bar, online ? styles.barQueue : styles.barOffline]}>
          {syncing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Feather name={online ? 'upload-cloud' : 'wifi-off'} size={15} color={online ? Colors.accent : Colors.warn} />}
          <Text style={styles.text} numberOfLines={2}>
            {syncing
              ? `Отправка… осталось ${queued}`
              : online
                ? `Ждут отправки: ${queued} ${plural(queued)}`
                : queued > 0
                  ? `Нет связи · на телефоне ${queued} ${plural(queued)}, отправятся сами`
                  : 'Нет связи · показаны сохранённые данные'}
          </Text>
          {queued > 0 && !syncing && (
            <TouchableOpacity style={styles.btn} onPress={() => { void acts.sync.now() }}>
              <Text style={styles.btnText}>Отправить</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {failed.length > 0 && (
        <TouchableOpacity style={[styles.bar, styles.barFailed]} onPress={showFailed} activeOpacity={0.8}>
          <Feather name="alert-triangle" size={15} color={Colors.danger} />
          <Text style={styles.text}>Сервер не принял: {failed.length}</Text>
          <Text style={[styles.btnText, { color: Colors.danger }]}>Подробнее</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6, gap: 6 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  barOffline: { backgroundColor: 'rgba(250,204,21,0.08)', borderColor: 'rgba(250,204,21,0.3)' },
  barQueue:   { backgroundColor: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)' },
  barFailed:  { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' },
  text:    { flex: 1, fontSize: 12, color: Colors.text1 },
  btn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.bg3 },
  btnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
})
