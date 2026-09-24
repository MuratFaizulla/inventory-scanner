// app/result/[id].tsx — итог акта: что поправить в 1С (термины — CONTEXT.md).
// Правило расхождений — в модуле акта, то же, что в портале «Расхождения 1С».

import { Feather } from '@expo/vector-icons'
import { useIsFocused } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAct, type Discrepancy, type DiscrepancyKind } from '../../constants/act'
import { Colors } from '../../constants/colors'
import { goBack } from '../../constants/nav'

import SyncBanner from '../../components/SyncBanner'

const KINDS: { kind: DiscrepancyKind; label: string; color: string }[] = [
  { kind: 'not_found', label: 'Не найдено',       color: Colors.danger },
  { kind: 'surplus',   label: 'Излишек',          color: Colors.accent },
  { kind: 'location',  label: 'Смена кабинета',   color: Colors.warn },
  { kind: 'employee',  label: 'Смена сотрудника', color: Colors.warn },
]
const META = Object.fromEntries(KINDS.map(k => [k.kind, k])) as Record<DiscrepancyKind, typeof KINDS[number]>
const ORDER = KINDS.map(k => k.kind)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''

export default function ActResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const { view, error, refresh } = useAct(Number(id), { live: isFocused })
  const [only, setOnly] = useState<DiscrepancyKind | null>(null)

  // Сначала то, что искать и списывать, потом излишки и перемещения
  const all = useMemo(() => [...(view?.discrepancies ?? [])].sort((a, b) =>
    ORDER.indexOf(a.kinds[0]) - ORDER.indexOf(b.kinds[0])
    || (a.item.name ?? '').localeCompare(b.item.name ?? '', 'ru')), [view])
  const counts = KINDS
    .map(k => ({ ...k, count: all.filter(d => d.kinds.includes(k.kind)).length }))
    .filter(k => k.count > 0)
  const shown = only ? all.filter(d => d.kinds.includes(only)) : all

  if (!view) return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={Colors.accent} size="large" />
      )}
    </View>
  )

  const { act, counts: c } = view
  const done = act.status === 'completed'

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.iconBtn}>
          <Feather name="arrow-left" size={19} color={Colors.text1} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{done ? 'Итог акта' : 'Предварительный итог'}</Text>
          <Text style={styles.sub} numberOfLines={1}>{act.title}</Text>
        </View>
        <TouchableOpacity onPress={() => { void refresh() }} style={styles.iconBtn}>
          <Feather name="refresh-cw" size={16} color={Colors.text2} />
        </TouchableOpacity>
      </View>

      <SyncBanner />

      <FlatList
        data={shown}
        keyExtractor={d => String(d.item.id)}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 2 }}>
            {done ? (
              <Text style={styles.when}>Завершён {fmtDate(act.completedAt)}</Text>
            ) : (
              <View style={styles.note}>
                <Feather name="clock" size={13} color={Colors.warn} style={{ marginTop: 1 }} />
                <Text style={styles.noteText}>
                  Акт ещё идёт.{c.pending > 0
                    ? ` Не проверено ОС: ${c.pending} — при завершении они станут «Не найдено».`
                    : ' Все ОС проверены — можно завершать.'}
                </Text>
              </View>
            )}

            <View style={styles.stats}>
              <Stat value={c.total} label="всего в акте" />
              <Stat value={c.found} label="на месте" color={Colors.accent2} />
              <Stat value={all.length} label="расхождений" color={all.length ? Colors.warn : Colors.accent2} />
            </View>

            {counts.length > 0 && (
              <View style={styles.chips}>
                {counts.map(k => {
                  const active = only === k.kind
                  return (
                    <TouchableOpacity
                      key={k.kind}
                      style={[styles.chip, { borderColor: active ? k.color : Colors.border }, active && { backgroundColor: Colors.bg3 }]}
                      onPress={() => setOnly(active ? null : k.kind)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, { color: k.color }]}>{k.label}</Text>
                      <Text style={[styles.chipCount, { color: k.color }]}>{k.count}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>
              {done ? 'Всё сходится с 1С — поправлять нечего' : 'Расхождений пока нет'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <DiscrepancyCard d={item} />}
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 6 }}>
            {all.length > 0 && (
              <Text style={styles.hint}>
                Бухгалтеру: портал → акт → «Расхождения 1С». Там тот же список и выгрузка в Excel.
              </Text>
            )}
            <TouchableOpacity
              style={styles.allBtn}
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: act.id } })}
            >
              <Feather name="list" size={14} color={Colors.accent} />
              <Text style={styles.allBtnText}>Все позиции акта</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  )
}

function Stat({ value, label, color = Colors.text1 }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function DiscrepancyCard({ d }: { d: Discrepancy }) {
  const { item } = d
  return (
    <View style={[styles.card, { borderLeftColor: META[d.kinds[0]].color }]}>
      <Text style={styles.name} numberOfLines={2}>{item.name ?? '—'}</Text>

      <View style={styles.badges}>
        {d.kinds.map(k => (
          <Text key={k} style={[styles.badge, { color: META[k].color, borderColor: META[k].color }]}>
            {META[k].label}
          </Text>
        ))}
        {!!(item.invNumber || item.barcode) && (
          <Text style={styles.code}># {item.invNumber || item.barcode}</Text>
        )}
      </View>

      {d.changes.map(ch => (
        <View key={ch.kind} style={styles.change}>
          <Text style={styles.changeLabel}>{ch.label}</Text>
          <Text style={styles.changeText}>
            <Text style={ch.from ? styles.from : styles.none}>{ch.from || 'не указан'}</Text>
            {'  →  '}
            <Text style={styles.to}>{ch.to}</Text>
          </Text>
        </View>
      ))}

      {!d.changes.some(ch => ch.kind === 'location') && !!item.location && (
        <Row icon="map-pin" text={item.location} />
      )}
      {!!item.mol && <Row icon="user" text={`МОЛ: ${item.mol}`} />}
      {!!d.action && <Row icon="corner-down-right" text={d.action} color={Colors.text1} />}

      {item.queued && (
        <Row icon="wifi-off" text="На телефоне — ждёт отправки" color={Colors.warn} />
      )}
    </View>
  )
}

function Row({ icon, text, color = Colors.text2 }: {
  icon: keyof typeof Feather.glyphMap; text: string; color?: string
}) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={12} color={Colors.text3} style={{ marginTop: 1 }} />
      <Text style={[styles.rowText, { color }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, color: Colors.text2, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  backBtn:     { backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: Colors.text1, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  sub:   { fontSize: 11, color: Colors.text3, marginTop: 2 },

  when: { fontSize: 12, color: Colors.text3 },
  note: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(250,204,21,0.08)', borderRadius: 10, padding: 10,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.warn },

  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10, color: Colors.text3, marginTop: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText:  { fontSize: 12, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },

  card: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, padding: 12, gap: 6,
  },
  name: { fontSize: 13, fontWeight: '600', color: Colors.text1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  badge: {
    fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden',
  },
  code: { fontSize: 11, color: Colors.text3, fontVariant: ['tabular-nums'] },

  change: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  changeLabel: { fontSize: 10, color: Colors.text3, marginBottom: 2 },
  changeText:  { fontSize: 12, color: Colors.text3 },
  from: { color: Colors.text2, textDecorationLine: 'line-through' },
  none: { color: Colors.text3, fontStyle: 'italic' },
  to:   { color: Colors.text1, fontWeight: '600' },

  row:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  rowText: { flex: 1, fontSize: 12, lineHeight: 16 },

  empty:     { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.text2, textAlign: 'center' },

  hint: { fontSize: 11, lineHeight: 16, color: Colors.text3, textAlign: 'center', paddingHorizontal: 8 },
  allBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0c2a4a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e4a7a',
  },
  allBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
})
