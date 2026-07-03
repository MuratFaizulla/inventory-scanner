import { Feather } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import api from '../../../constants/api'
import {
  ChangesResponse, FIELD_LABELS, formatDate,
  SyncChange, SyncStatus, T,
} from './types'

// ── Карточка статуса — 1:1 c OnecSyncPage → StatusCard ──────────────────────

function StatusCard({ status, onRun, running }: {
  status: SyncStatus | null
  onRun: () => void
  running: boolean
}) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusTitleRow}>
        <Feather name="database" size={14} color={T.accent} />
        <Text style={styles.statusTitle}>Статус синхронизации с 1С</Text>
      </View>

      <TouchableOpacity
        style={[styles.runBtn, running && { opacity: 0.6 }]}
        onPress={onRun}
        disabled={running}
        activeOpacity={0.8}
      >
        {running
          ? <ActivityIndicator size={14} color="#fff" />
          : <Feather name="play" size={14} color="#fff" />}
        <Text style={styles.runBtnText}>
          {running ? 'Синхронизация...' : 'Запустить синхронизацию'}
        </Text>
      </TouchableOpacity>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Feather name="clock" size={11} color={T.textFaint} />
            <Text style={styles.statLabel}>Последний запуск</Text>
          </View>
          <Text style={styles.statVal}>{formatDate(status?.lastRun ?? null)}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Feather name="check-circle" size={11} color={T.textFaint} />
            <Text style={styles.statLabel}>Успешно завершён</Text>
          </View>
          <Text style={[styles.statVal, { color: T.emerald }]}>
            {formatDate(status?.lastSuccess ?? null)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Feather name="package" size={11} color={T.textFaint} />
            <Text style={styles.statLabel}>Основных активов</Text>
          </View>
          <Text style={styles.statValLarge}>{status?.totalFixed ?? '—'}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Feather name="book-open" size={11} color={T.textFaint} />
            <Text style={styles.statLabel}>Библиотечных</Text>
          </View>
          <Text style={styles.statValLarge}>{status?.totalLibrary ?? '—'}</Text>
        </View>
      </View>

      {!!status?.lastError && (
        <View style={styles.statusError}>
          <Feather name="alert-triangle" size={14} color={T.danger} style={{ marginTop: 2 }} />
          <Text style={styles.statusErrorMsg}>{status.lastError}</Text>
        </View>
      )}

      {running && (
        <View style={styles.statusRunning}>
          <ActivityIndicator size={14} color={T.accent} />
          <Text style={styles.statusRunningMsg}>
            Идёт синхронизация, это может занять несколько минут...
          </Text>
        </View>
      )}
    </View>
  )
}

// ── Секции изменений — 1:1 c OnecSyncPage → ChangeSection/ChangeItem ────────

const SECTION_META = {
  added:   { label: 'Добавлено', icon: 'plus-circle' as const, color: T.emerald, countBg: T.emeraldBg },
  updated: { label: 'Изменено',  icon: 'edit-2'      as const, color: T.warning, countBg: T.warningBg },
  removed: { label: 'Удалено',   icon: 'trash-2'     as const, color: T.danger,  countBg: T.dangerBg },
}

function ChangeItem({ item, type }: { item: SyncChange; type: keyof typeof SECTION_META }) {
  return (
    <View style={styles.changeItem}>
      <View style={styles.changeItemHead}>
        {!!item.invNumber && (
          <Text style={styles.changeItemInv}>{item.invNumber}</Text>
        )}
        <Text style={styles.changeItemDesc} numberOfLines={2}>
          {item.description || '—'}
        </Text>
        {type === 'updated' && (
          <View style={styles.changeItemTable}>
            <Text style={styles.changeItemTableText}>
              {item.assetTable === 'library' ? 'Библ.' : 'ОС'}
            </Text>
          </View>
        )}
      </View>
      {type === 'updated' && item.changedFields?.map((cf, i) => (
        <View key={i} style={styles.changeField}>
          <Text style={styles.changeFieldName}>
            {FIELD_LABELS[cf.field] ?? cf.field}
          </Text>
          <Text style={styles.changeFieldOld}>{cf.oldValue || '—'}</Text>
          <Feather name="arrow-right" size={11} color={T.textFaint} />
          <Text style={styles.changeFieldNew}>{cf.newValue || '—'}</Text>
        </View>
      ))}
    </View>
  )
}

function ChangeSection({ type, items }: {
  type: keyof typeof SECTION_META
  items: SyncChange[]
}) {
  const [expanded, setExpanded] = useState(true)
  const [showAll,  setShowAll]  = useState(false)

  if (items.length === 0) return null

  const meta = SECTION_META[type]
  const visible = showAll ? items : items.slice(0, 25)

  return (
    <View style={styles.changeSection}>
      <TouchableOpacity
        style={styles.changeSectionHead}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.changeSectionLabel}>
          <Feather name={meta.icon} size={14} color={meta.color} />
          <Text style={[styles.changeSectionLabelText, { color: meta.color }]}>
            {meta.label}
          </Text>
          <View style={[styles.changeSectionCount, { backgroundColor: meta.countBg }]}>
            <Text style={[styles.changeSectionCountText, { color: meta.color }]}>
              {items.length}
            </Text>
          </View>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={T.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.changeSectionBody}>
          {visible.map(item => (
            <ChangeItem key={item.id} item={item} type={type} />
          ))}
          {!showAll && items.length > 25 && (
            <TouchableOpacity style={styles.showMore} onPress={() => setShowAll(true)}>
              <Text style={styles.showMoreText}>
                Показать ещё {items.length - 25}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

// ── Страница: шапка + статус + изменения — 1:1 c OnecSyncPage ───────────────

export default function SyncView() {
  const [status,         setStatus]         = useState<SyncStatus | null>(null)
  const [changes,        setChanges]        = useState<ChangesResponse | null>(null)
  const [changesLoading, setChangesLoading] = useState(true)
  const [running,        setRunning]        = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/onec-sync/status')
      setStatus(res.data.data)
      setRunning(res.data.data?.running ?? false)
    } catch { /* ignore — как в вебе */ }
  }, [])

  const loadChanges = useCallback(async () => {
    setChangesLoading(true)
    try {
      const res = await api.get('/onec-sync/changes')
      setChanges(res.data.data)
    } catch {
      setChanges(null)
    } finally {
      setChangesLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus(); loadChanges() }, [loadStatus, loadChanges])

  // Пока идёт синхронизация — опрос статуса каждые 3 секунды (как в вебе)
  useEffect(() => {
    if (!running) return
    pollRef.current = setInterval(loadStatus, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [running, loadStatus])

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await api.post('/onec-sync/run')
      setStatus(res.data.data)
      setRunning(res.data.data?.running ?? false)
      await loadChanges()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Ошибка запуска'
      setStatus(s => (s ? { ...s, lastError: msg } : s))
      setRunning(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadStatus(), loadChanges()])
    setRefreshing(false)
  }

  const totalChanges = changes
    ? changes.added.length + changes.updated.length + changes.removed.length
    : 0

  return (
    <ScrollView
      style={{ backgroundColor: T.bg }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={T.accent}
          colors={[T.accent]}
        />
      }
    >
      {/* ── Шапка страницы ── */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.pageTitleRow}>
            <View style={styles.titleBar} />
            <Feather name="database" size={20} color={T.accent} />
            <Text style={styles.pageTitle}>Синхронизация 1С</Text>
          </View>
          <Text style={styles.pageSub}>
            Основные средства и библиотечный фонд из выгрузки 1С
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadStatus} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={15} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      <StatusCard status={status} onRun={handleRun} running={running} />

      {/* ── Изменения последней синхронизации ── */}
      <View style={styles.changesWrap}>
        <View style={styles.changesHeader}>
          <Text style={styles.changesTitle}>Изменения последней синхронизации</Text>
          {!!changes?.syncedAt && (
            <Text style={styles.changesSyncedAt}>{formatDate(changes.syncedAt)}</Text>
          )}
        </View>

        {changesLoading ? (
          <View style={styles.changesLoading}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : !changes || totalChanges === 0 ? (
          <View style={styles.changesEmpty}>
            <Feather name="inbox" size={36} color={T.textFaint} style={{ opacity: 0.35 }} />
            <Text style={styles.changesEmptyTitle}>
              {!changes?.syncedAt
                ? 'Нет данных — запустите первую синхронизацию'
                : 'Изменений не найдено — данные совпадают с предыдущей выгрузкой'}
            </Text>
          </View>
        ) : (
          <View>
            <ChangeSection type="added"   items={changes.added} />
            <ChangeSection type="updated" items={changes.updated} />
            <ChangeSection type="removed" items={changes.removed} />
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20, paddingBottom: 32 },

  /* Шапка страницы */
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: T.border,
  },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBar: { width: 4, height: 24, borderRadius: 2, backgroundColor: T.accent },
  pageTitle: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.5,
    color: T.textPrimary, flexShrink: 1,
  },
  pageSub: { fontSize: 13, color: T.textFaint, marginTop: 4 },
  refreshBtn: {
    padding: 8, borderRadius: 12, backgroundColor: T.elevated,
    marginLeft: 12,
  },

  /* Карточка статуса */
  statusCard: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 20, gap: 16,
  },
  statusTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontSize: 14, fontWeight: '600', color: T.textSecondary },

  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.accent, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  runBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    backgroundColor: T.elevated, borderRadius: 16, padding: 12,
    flexBasis: '46%', flexGrow: 1,
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  statLabel:    { fontSize: 12, color: T.textFaint },
  statVal:      { fontSize: 14, color: T.textSecondary },
  statValLarge: { fontSize: 24, fontWeight: '700', color: T.textPrimary },

  statusError: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: T.dangerBg, borderWidth: 1, borderColor: T.dangerBorder,
    borderRadius: 12, padding: 12,
  },
  statusErrorMsg: { fontSize: 14, color: T.danger, flex: 1 },

  statusRunning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 12, padding: 12,
  },
  statusRunningMsg: { fontSize: 14, color: T.accent, flex: 1 },

  /* Панель изменений */
  changesWrap: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, overflow: 'hidden',
  },
  changesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  changesTitle:    { fontSize: 15, fontWeight: '600', color: T.textSecondary, flexShrink: 1 },
  changesSyncedAt: { fontSize: 12, color: T.textFaint },

  changesLoading: { paddingVertical: 48, alignItems: 'center' },

  changesEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 48, paddingHorizontal: 24, gap: 12,
  },
  changesEmptyTitle: {
    fontSize: 14, color: T.textFaint, textAlign: 'center', lineHeight: 20,
  },

  /* Секция изменений */
  changeSection: { borderBottomWidth: 1, borderBottomColor: T.borderFaint },

  changeSectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
  },
  changeSectionLabel:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changeSectionLabelText: { fontSize: 14, fontWeight: '500' },
  changeSectionCount: {
    borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2,
  },
  changeSectionCountText: { fontSize: 12, fontWeight: '600' },

  changeSectionBody: { borderTopWidth: 1, borderTopColor: T.borderFaint },

  /* Элемент изменения */
  changeItem: {
    paddingVertical: 10, paddingRight: 20, paddingLeft: 36,
    borderBottomWidth: 1, borderBottomColor: T.borderFaint,
  },
  changeItemHead: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    marginBottom: 4,
  },
  changeItemInv: {
    fontSize: 11, color: T.textFaint, fontVariant: ['tabular-nums'],
  },
  changeItemDesc: {
    fontSize: 14, fontWeight: '500', color: T.textSecondary, flexShrink: 1,
  },
  changeItemTable: {
    backgroundColor: T.elevated, borderRadius: 9999,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  changeItemTableText: { fontSize: 11, color: T.textFaint },

  /* Дифф поля */
  changeField: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 6, marginTop: 4,
  },
  changeFieldName: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
    color: T.textFaint, minWidth: 96,
  },
  changeFieldOld: { fontSize: 13, color: T.danger },
  changeFieldNew: { fontSize: 13, color: T.emerald },

  showMore:     { paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' },
  showMoreText: { fontSize: 13, color: T.textFaint },
})
