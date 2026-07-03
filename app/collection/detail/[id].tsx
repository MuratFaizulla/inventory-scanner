// app/collection/detail/[id].tsx — Детали сессии сбора ОС (аккордеон по кабинетам)

import * as Haptics from 'expo-haptics'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, LayoutAnimation,
  Platform, StyleSheet, Text, TouchableOpacity,
  UIManager, View,
} from 'react-native'
import api from '../../../constants/api'
import { goBack } from '../../../constants/nav'
import { Colors } from '../../../constants/colors'

// Включаем анимацию на Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemStatus = 'PENDING' | 'RETURNED' | 'DAMAGED' | 'LOST'
type FilterTab  = 'ALL' | ItemStatus

interface CollectionItem {
  id:         number
  status:     ItemStatus
  returnedAt: string | null
  returnedBy: string | null
  note:       string | null
  asset: {
    id:              number
    inventoryNumber: string
    name:            string
    barcode:         string | null
    location:        { name: string } | null
    responsiblePerson: { fullName: string } | null
    employee:        { fullName: string } | null
  }
}

interface LocationGroup {
  location: string
  items:    CollectionItem[]
  all:      CollectionItem[]   // все без фильтра (для статистики)
  total:    number
  returned: number
  damaged:  number
  lost:     number
  pending:  number
  done:     number
  pct:      number
}

interface SessionDetail {
  id:        number
  name:      string
  status:    'OPEN' | 'CLOSED'
  assetType: string | null
  stats: {
    total:    number
    returned: number
    damaged:  number
    lost:     number
    pending:  number
  }
  items: CollectionItem[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
  RETURNED: { label: '✅ Принято',    color: Colors.accent2, bg: '#052e16', border: '#16a34a' },
  DAMAGED:  { label: '⚠️ Повреждено', color: Colors.warn,    bg: '#422006', border: '#ca8a04' },
  LOST:     { label: '🔴 Утеряно',    color: '#c084fc',      bg: '#3b0764', border: '#9333ea' },
  PENDING:  { label: '⏳ Не сдано',   color: Colors.danger,  bg: '#1a0a0a', border: '#4a1a1a' },
}

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null

function buildGroups(items: CollectionItem[], filter: FilterTab): LocationGroup[] {
  const map = new Map<string, CollectionItem[]>()
  for (const item of items) {
    const loc = item.asset.location?.name ?? 'Без кабинета'
    if (!map.has(loc)) map.set(loc, [])
    map.get(loc)!.push(item)
  }

  return Array.from(map.entries())
    .map(([location, all]) => {
      const returned = all.filter(i => i.status === 'RETURNED').length
      const damaged  = all.filter(i => i.status === 'DAMAGED').length
      const lost     = all.filter(i => i.status === 'LOST').length
      const pending  = all.filter(i => i.status === 'PENDING').length
      const done     = returned + damaged + lost
      const pct      = all.length > 0 ? Math.round(done / all.length * 100) : 0
      const filtered = filter === 'ALL' ? all : all.filter(i => i.status === filter)
      return { location, items: filtered, all, total: all.length, returned, damaged, lost, pending, done, pct }
    })
    .sort((a, b) => a.location.localeCompare(b.location, 'ru'))
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CollectionDetailScreen() {
  const { id, sessionName } = useLocalSearchParams<{ id: string; sessionName: string }>()
  const router = useRouter()

  const [session,    setSession]    = useState<SessionDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterTab>('ALL')
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [cancelling, setCancelling] = useState<number | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/collection/${id}`)
      setSession(res.data)
    } catch {
      if (!silent) Alert.alert('Ошибка', 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(useCallback(() => {
    load()
    intervalRef.current = setInterval(() => load(true), 6000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load]))

  const toggleGroup = (location: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    Haptics.selectionAsync()
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(location) ? next.delete(location) : next.add(location)
      return next
    })
  }

  const handleCancel = (item: CollectionItem) => {
    Alert.alert(
      'Отменить приёмку?',
      `"${item.asset.name}" вернётся в статус "Не сдано"`,
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить', style: 'destructive',
          onPress: async () => {
            setCancelling(item.id)
            try {
              await api.patch(`/collection/${id}/item/${item.id}/cancel`)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              await load(true)
            } catch {
              Alert.alert('Ошибка', 'Не удалось отменить')
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            } finally {
              setCancelling(null)
            }
          },
        },
      ]
    )
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  )
  if (!session) return null

  const { stats } = session
  const pct = stats.total > 0
    ? Math.round((stats.returned + stats.damaged + stats.lost) / stats.total * 100)
    : 0

  const groups = buildGroups(session.items, filter)

  const FILTERS: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'ALL',      label: 'Все',       count: stats.total,    color: Colors.text2   },
    { key: 'PENDING',  label: '⏳ Не сдали', count: stats.pending,  color: Colors.danger  },
    { key: 'RETURNED', label: '✅ Сдали',   count: stats.returned, color: Colors.accent2 },
    { key: 'DAMAGED',  label: '⚠️ Поврежд', count: stats.damaged,  color: Colors.warn    },
    { key: 'LOST',     label: '🔴 Утеряно', count: stats.lost,     color: '#c084fc'      },
  ]

  return (
    <View style={styles.container}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            📥 {sessionName || session.name}
          </Text>
          <Text style={styles.headerSub}>
            {pct}% завершено · {stats.total} ОС
            {session.status === 'CLOSED' ? ' · 🔒 Закрыта' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ── Статы ─────────────────────────────────────────────────────────── */}
      <View style={styles.statsBar}>
        {([
          { label: 'Всего',    value: stats.total,    color: Colors.text2   },
          { label: '✅ Сдали', value: stats.returned, color: Colors.accent2 },
          { label: '⚠️',       value: stats.damaged,  color: Colors.warn    },
          { label: '🔴',       value: stats.lost,     color: '#c084fc'      },
          { label: '⏳ Осталось', value: stats.pending, color: Colors.danger },
        ] as { label: string; value: number; color: string }[]).map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLbl}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Сегментный прогресс-бар ───────────────────────────────────────── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View style={[styles.seg, { flex: stats.returned, backgroundColor: Colors.accent2 }]} />
          <View style={[styles.seg, { flex: stats.damaged,  backgroundColor: Colors.warn    }]} />
          <View style={[styles.seg, { flex: stats.lost,     backgroundColor: '#c084fc'      }]} />
          <View style={{ flex: stats.pending }} />
        </View>
        <Text style={styles.progressLabel}>{pct}%</Text>
      </View>

      {/* ── Фильтр ────────────────────────────────────────────────────────── */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterBtn,
              filter === f.key && { borderColor: f.color, backgroundColor: f.color + '22' },
            ]}
            onPress={() => { setFilter(f.key); Haptics.selectionAsync() }}
          >
            <Text style={[styles.filterLabel, filter === f.key && { color: f.color }]}>
              {f.label}
            </Text>
            <Text style={[styles.filterCount, filter === f.key && { color: f.color }]}>
              {f.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Кабинеты (аккордеон) ──────────────────────────────────────────── */}
      <FlatList
        data={groups}
        keyExtractor={g => g.location}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Нет данных</Text>
          </View>
        }
        renderItem={({ item: group }) => {
          const isOpen   = expanded.has(group.location)
          const allDone  = group.pending === 0
          const pctColor = allDone ? Colors.accent2 : group.pct >= 50 ? Colors.warn : Colors.danger

          return (
            <View style={[styles.groupCard, allDone && styles.groupCardDone]}>

              {/* ── Заголовок кабинета (тап = раскрыть) ── */}
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => toggleGroup(group.location)}
                activeOpacity={0.75}
              >
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupArrow}>{isOpen ? '▼' : '▶'}</Text>
                  <Text style={styles.groupName} numberOfLines={1}>
                    📍 {group.location}
                  </Text>
                  <Text style={[styles.groupPct, { color: pctColor }]}>{group.pct}%</Text>
                </View>

                {/* Прогресс-бар кабинета */}
                <View style={styles.groupBarBg}>
                  <View style={[styles.groupBarSeg, { flex: group.returned, backgroundColor: Colors.accent2 }]} />
                  <View style={[styles.groupBarSeg, { flex: group.damaged,  backgroundColor: Colors.warn    }]} />
                  <View style={[styles.groupBarSeg, { flex: group.lost,     backgroundColor: '#c084fc'      }]} />
                  <View style={{ flex: group.pending }} />
                </View>

                {/* Мини-статистика */}
                <View style={styles.groupStatRow}>
                  <StatChip icon="✅" val={group.returned} color={Colors.accent2} />
                  <StatChip icon="⚠️" val={group.damaged}  color={Colors.warn}    />
                  <StatChip icon="🔴" val={group.lost}     color="#c084fc"        />
                  <StatChip icon="⏳" val={group.pending}  color={Colors.danger}  />
                  <Text style={styles.groupTotal}>{group.done}/{group.total}</Text>
                </View>
              </TouchableOpacity>

              {/* ── Список ОС (видим только если открыт) ── */}
              {isOpen && (
                <View style={styles.groupItems}>
                  {group.items.length === 0 ? (
                    <Text style={styles.noItems}>Нет записей с выбранным фильтром</Text>
                  ) : (
                    group.items.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        cancelling={cancelling}
                        onCancel={handleCancel}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
          )
        }}
      />
    </View>
  )
}

// ─── Мини-статистика ─────────────────────────────────────────────────────────

function StatChip({ icon, val, color }: { icon: string; val: number; color: string }) {
  return (
    <View style={chipStyles.wrap}>
      <Text style={chipStyles.icon}>{icon}</Text>
      <Text style={[chipStyles.val, { color }]}>{val}</Text>
    </View>
  )
}
const chipStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  icon: { fontSize: 11 },
  val:  { fontSize: 13, fontWeight: '700' },
})

// ─── Карточка ОС ─────────────────────────────────────────────────────────────

function ItemCard({
  item, cancelling, onCancel,
}: {
  item:       CollectionItem
  cancelling: number | null
  onCancel:   (item: CollectionItem) => void
}) {
  const cfg  = STATUS_CFG[item.status]
  const time = fmtTime(item.returnedAt)

  return (
    <View style={[
      styles.itemCard,
      { borderLeftColor: cfg.color },
      item.status === 'PENDING' && { opacity: 0.65 },
    ]}>
      <View style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={2}>{item.asset.name}</Text>
          <Text style={styles.itemInv}>{item.asset.inventoryNumber}</Text>
          {item.asset.employee && (
            <Text style={styles.itemMeta}>🧑‍💼 {item.asset.employee.fullName}</Text>
          )}
          {item.asset.responsiblePerson && (
            <Text style={styles.itemMeta}>👔 {item.asset.responsiblePerson.fullName}</Text>
          )}
        </View>

        {/* Бейдж статуса */}
        <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Кто принял и когда */}
      {item.status !== 'PENDING' && (item.returnedBy || time) && (
        <View style={styles.itemFooter}>
          {item.returnedBy && <Text style={styles.footerText}>🔍 {item.returnedBy}</Text>}
          {time && <Text style={styles.footerText}>{time}</Text>}
        </View>
      )}

      {/* Кнопка отмены */}
      {item.status !== 'PENDING' && (
        <TouchableOpacity
          style={[styles.cancelBtn, cancelling === item.id && { opacity: 0.5 }]}
          onPress={() => onCancel(item)}
          disabled={cancelling === item.id}
        >
          <Text style={styles.cancelText}>
            {cancelling === item.id ? '⏳ Отмена...' : '✕ Отменить'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { paddingVertical: 4, paddingRight: 8 },
  backText:    { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  headerSub:   { fontSize: 11, color: Colors.text3, marginTop: 2 },
  refreshBtn:  { padding: 8 },
  refreshText: { fontSize: 18 },

  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 17, fontWeight: '800' },
  statLbl:  { fontSize: 8, color: Colors.text3, marginTop: 2, textAlign: 'center' },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  progressBg: {
    flex: 1, height: 8, backgroundColor: Colors.border,
    borderRadius: 4, flexDirection: 'row', overflow: 'hidden',
  },
  seg:           { height: '100%' },
  progressLabel: { fontSize: 13, fontWeight: '700', color: Colors.text2, width: 36, textAlign: 'right' },

  filterRow: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    paddingHorizontal: 8, paddingVertical: 8, gap: 5,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  filterLabel: { fontSize: 9,  color: Colors.text3, fontWeight: '600' },
  filterCount: { fontSize: 15, color: Colors.text3, fontWeight: '800', marginTop: 1 },

  // Группа (кабинет)
  groupCard: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  groupCardDone: { borderColor: '#2d6a45' },

  groupHeader: { padding: 14 },
  groupTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  groupArrow: { fontSize: 10, color: Colors.text3, width: 12 },
  groupName:  { fontSize: 15, fontWeight: '700', color: Colors.text1, flex: 1 },
  groupPct:   { fontSize: 20, fontWeight: '800' },

  groupBarBg: {
    height: 6, backgroundColor: Colors.border, borderRadius: 3,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 10,
  },
  groupBarSeg: { height: '100%' },

  groupStatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupTotal:   { marginLeft: 'auto', fontSize: 12, color: Colors.text3, fontWeight: '600' },

  // Список внутри
  groupItems: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10,
    gap: 8,
  },
  noItems: { fontSize: 13, color: Colors.text3, textAlign: 'center', paddingVertical: 12 },

  // Карточка ОС
  itemCard: {
    backgroundColor: Colors.bg,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, padding: 12,
  },
  itemRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName:  { fontSize: 13, fontWeight: '600', color: Colors.text1, marginBottom: 2 },
  itemInv:   { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 4 },
  itemMeta:  { fontSize: 11, color: Colors.text3, marginTop: 1 },

  badge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, flexShrink: 0,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  itemFooter:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footerText:  { fontSize: 10, color: Colors.text3 },

  cancelBtn: {
    marginTop: 8, alignSelf: 'flex-end',
    backgroundColor: '#1a0a0a', borderRadius: 6,
    paddingVertical: 5, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#4a1a1a',
  },
  cancelText: { color: Colors.danger, fontSize: 11, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.text3 },
})
