import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import api from '../../../constants/api'
import { Colors } from '../../../constants/colors'

// ── Типы ─────────────────────────────────────────────────────────────────────

type AssetInfo = {
  id:                number
  itemId:            number
  name:              string
  inventoryNumber:   string
  barcode:           string | null
  responsiblePerson: string | null
  employee:          string | null
  scannedAt:         string | null
  scannedBy:         string | null
  note:              string | null
}

type LocationStat = {
  locationId:      number
  locationName:    string
  total:           number
  found:           number
  notFound:        number
  misplaced:       number
  pending:         number
  progress:        number
  totalAssets:     AssetInfo[]
  foundAssets:     AssetInfo[]
  notFoundAssets:  AssetInfo[]
  misplacedAssets: AssetInfo[]
  pendingAssets:   AssetInfo[]
}

type ExpandedType = 'total' | 'found' | 'notFound' | 'misplaced' | 'pending' | null

interface Props {
  sessionId: string
  onBack:    () => void
}

// ── Skeleton — мигающая заглушка ─────────────────────────────────────────────

function SkeletonBox({ width, height, style }: {
  width?:  number | string
  height:  number
  style?:  object
}) {
  const anim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue:         1,
          duration:        700,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue:         0.3,
          duration:        700,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View style={[
      {
        width:           width ?? '100%',
        height,
        borderRadius:    6,
        backgroundColor: Colors.bg3,
        opacity:         anim,
      },
      style,
    ]} />
  )
}

// Скелетон одной карточки кабинета
function SkeletonCard() {
  return (
    <View style={[styles.card, { borderLeftColor: Colors.bg3, padding: 14, gap: 10 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBox width="60%" height={14} />
        <SkeletonBox width={36} height={14} />
      </View>
      <SkeletonBox height={4} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1,2,3,4,5].map(i => (
          <View key={i} style={{ flex: 1, gap: 4 }}>
            <SkeletonBox height={18} />
            <SkeletonBox height={10} />
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Главный экран ─────────────────────────────────────────────────────────────

export default function StatsByLocationScreen({ sessionId, onBack }: Props) {
  const [stats,          setStats]          = useState<LocationStat[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [locationSearch, setLocationSearch] = useState('')

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await api.get(`/inventory/${sessionId}/stats/by-location`)
      setStats(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const filteredStats = locationSearch.trim()
    ? stats.filter(s => s.locationName.toLowerCase().includes(locationSearch.toLowerCase()))
    : stats

  const totalPending  = stats.reduce((s, l) => s + l.pending, 0)
  const totalFound    = stats.reduce((s, l) => s + l.found, 0)
  const totalAll      = stats.reduce((s, l) => s + l.total, 0)
  const totalProgress = totalAll > 0 ? Math.round((totalFound / totalAll) * 100) : 0

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Прогресс по кабинетам</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Загрузка...' : `${stats.length} кабинетов · ${totalPending} не проверено`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => fetchStats(true)} style={styles.refreshBtn} disabled={refreshing || loading}>
          <Text style={styles.refreshBtnText}>{refreshing ? '...' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        // ── Skeleton ──────────────────────────────────────────────────────────
        <View style={{ flex: 1 }}>
          {/* Скелетон сводной статистики */}
          <View style={[styles.summaryRow, { paddingTop: 12 }]}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.summaryCard, { gap: 6 }]}>
                <SkeletonBox height={20} width="60%" style={{ alignSelf: 'center' }} />
                <SkeletonBox height={10} width="80%" style={{ alignSelf: 'center' }} />
              </View>
            ))}
          </View>
          {/* Скелетон поиска */}
          <View style={{ marginHorizontal: 12, marginTop: 10 }}>
            <SkeletonBox height={42} style={{ borderRadius: 10 }} />
          </View>
          {/* Скелетон карточек */}
          <View style={{ padding: 12, gap: 8 }}>
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </View>
        </View>
      ) : (
        <>
          {/* Общая статистика */}
          <View style={styles.summaryRow}>
            {([
              { label: 'Всего',        value: totalAll,            color: Colors.text2   },
              { label: 'Найдено',      value: totalFound,          color: Colors.accent2 },
              { label: 'Не проверено', value: totalPending,        color: Colors.text2   },
              { label: 'Прогресс',     value: `${totalProgress}%`, color: totalProgress === 100 ? Colors.accent2 : Colors.accent },
            ]).map(s => (
              <View key={s.label} style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Поиск */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={locationSearch}
              onChangeText={setLocationSearch}
              placeholder="🔍 Поиск по кабинету..."
              placeholderTextColor={Colors.text3}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {locationSearch.length > 0 && (
              <TouchableOpacity onPress={() => setLocationSearch('')} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Список */}
          {filteredStats.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Ничего не найдено</Text>
            </View>
          ) : (
            <FlatList
              data={filteredStats}
              keyExtractor={i => String(i.locationId)}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <LocationCard loc={item} />}
            />
          )}
        </>
      )}
    </View>
  )
}

// ── Карточка кабинета ─────────────────────────────────────────────────────────

function LocationCard({ loc }: { loc: LocationStat }) {
  const [expanded, setExpanded] = useState<ExpandedType>(null)
  const [search,   setSearch]   = useState('')

  const progressColor = loc.progress === 100
    ? Colors.accent2
    : loc.progress > 50
      ? Colors.accent
      : Colors.warn

  const cells: {
    key:    ExpandedType
    label:  string
    value:  number
    color:  string
    assets: AssetInfo[]
  }[] = [
    { key: 'total',     label: 'Всего',       value: loc.total,     color: Colors.text2,   assets: loc.totalAssets     },
    { key: 'found',     label: 'Найдено',      value: loc.found,     color: Colors.accent2, assets: loc.foundAssets     },
    { key: 'notFound',  label: 'Не найдено',   value: loc.notFound,  color: Colors.danger,  assets: loc.notFoundAssets  },
    { key: 'misplaced', label: 'Не на месте',  value: loc.misplaced, color: Colors.warn,    assets: loc.misplacedAssets },
    { key: 'pending',   label: 'Не проверено', value: loc.pending,   color: loc.pending > 0 ? Colors.text1 : Colors.text3, assets: loc.pendingAssets },
  ]

  const currentAssets = cells.find(c => c.key === expanded)?.assets ?? []
  const filteredAssets = search.trim()
    ? currentAssets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.inventoryNumber.toLowerCase().includes(search.toLowerCase()) ||
        (a.barcode ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.responsiblePerson ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.employee ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.scannedBy ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : currentAssets

  const handleCellPress = (key: ExpandedType, count: number) => {
    if (count === 0) return
    if (expanded === key) { setExpanded(null); setSearch('') }
    else                  { setExpanded(key);  setSearch('') }
  }

  const expandedLabel = cells.find(c => c.key === expanded)?.label ?? ''

  return (
    <View style={[
      styles.card,
      { borderLeftColor: progressColor },
      loc.progress === 100 && styles.cardDone,
    ]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, loc.progress === 100 && { color: Colors.text3 }]} numberOfLines={2}>
          {loc.progress === 100 ? '✅ ' : '📍 '}{loc.locationName}
        </Text>
        <Text style={[styles.cardPercent, { color: progressColor }]}>{loc.progress}%</Text>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${loc.progress}%` as any, backgroundColor: progressColor }]} />
      </View>

      <View style={styles.statsRow}>
        {cells.map(cell => (
          <TouchableOpacity
            key={cell.key}
            style={[
              styles.statCell,
              expanded === cell.key && styles.statCellActive,
              cell.value === 0 && styles.statCellEmpty,
            ]}
            onPress={() => handleCellPress(cell.key, cell.value)}
            activeOpacity={cell.value > 0 ? 0.7 : 1}
          >
            <Text style={[styles.statValue, { color: cell.color }]}>
              {cell.value}
              {cell.value > 0 && (
                <Text style={{ fontSize: 9 }}>{expanded === cell.key ? ' ▲' : ' ▼'}</Text>
              )}
            </Text>
            <Text style={styles.statLabel} numberOfLines={2}>{cell.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {expanded && (
        <AssetList
          title={`${expandedLabel}: ${currentAssets.length}`}
          assets={filteredAssets}
          search={search}
          onSearch={setSearch}
          onClose={() => { setExpanded(null); setSearch('') }}
          showScanInfo={expanded === 'found' || expanded === 'misplaced'}
        />
      )}
    </View>
  )
}

// ── Список активов ────────────────────────────────────────────────────────────

function AssetList({ title, assets, search, onSearch, onClose, showScanInfo }: {
  title:        string
  assets:       AssetInfo[]
  search:       string
  onSearch:     (v: string) => void
  onClose:      () => void
  showScanInfo: boolean
}) {
  const fmtDate = (d: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <View style={styles.assetList}>
      <View style={styles.assetListHeader}>
        <Text style={styles.assetListTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.assetListClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.assetSearchWrap}>
        <TextInput
          style={styles.assetSearch}
          value={search}
          onChangeText={onSearch}
          placeholder="Поиск по названию, инв. номеру, штрих-коду, МОЛ..."
          placeholderTextColor={Colors.text3}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} style={{ padding: 4 }}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.assetScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {assets.length === 0 ? (
          <Text style={styles.assetEmpty}>Ничего не найдено</Text>
        ) : assets.map((a, i) => (
          <View key={a.id} style={styles.assetItem}>
            <Text style={styles.assetIndex}>{i + 1}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.assetName} numberOfLines={2}>{a.name}</Text>
              <View style={styles.assetCodes}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>инв: {a.inventoryNumber}</Text>
                </View>
                {a.barcode ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>🔍 {a.barcode}</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { opacity: 0.4 }]}>
                    <Text style={styles.badgeText}>нет штрих-кода</Text>
                  </View>
                )}
              </View>
              <View style={styles.assetMeta}>
                {a.responsiblePerson && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>👤</Text>
                    <Text style={styles.metaText} numberOfLines={1}>{a.responsiblePerson}</Text>
                  </View>
                )}
                {a.employee && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>🧑‍💼</Text>
                    <Text style={styles.metaText} numberOfLines={1}>{a.employee}</Text>
                  </View>
                )}
              </View>
              {showScanInfo && (a.scannedAt || a.scannedBy || a.note) && (
                <View style={styles.scanInfo}>
                  {a.scannedBy && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaIcon}>🔍</Text>
                      <Text style={styles.scanText} numberOfLines={1}>{a.scannedBy}</Text>
                    </View>
                  )}
                  {a.scannedAt && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaIcon}>🕐</Text>
                      <Text style={styles.scanText}>{fmtDate(a.scannedAt)}</Text>
                    </View>
                  )}
                  {a.note && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaIcon}>📝</Text>
                      <Text style={[styles.scanText, { color: Colors.warn }]} numberOfLines={3}>{a.note}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

// ── Стили ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.text3, marginTop: 8 },
  emptyText:   { fontSize: 14, color: Colors.text3 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:        { padding: 4 },
  backText:       { fontSize: 24, color: Colors.accent },
  headerTitle:    { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  headerSub:      { fontSize: 11, color: Colors.text3, marginTop: 2 },
  refreshBtn:     { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  refreshBtnText: { fontSize: 13, color: Colors.text2 },

  summaryRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.bg2,
    borderRadius: 10, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 9, color: Colors.text3, marginTop: 3, textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 10,
    backgroundColor: Colors.bg2,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchInput:     { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text1 },
  searchClear:     { padding: 4 },
  searchClearText: { fontSize: 14, color: Colors.text3 },

  card: {
    backgroundColor: Colors.bg2,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, overflow: 'hidden',
  },
  cardDone: { opacity: 0.55 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
  },
  cardName:    { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text1 },
  cardPercent: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 0 },
  progressBg:   { height: 4, backgroundColor: Colors.bg3, marginHorizontal: 14, borderRadius: 2, marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 2 },

  statsRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingBottom: 12 },
  statCell: {
    flex: 1, backgroundColor: Colors.bg3,
    borderRadius: 8, padding: 6, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  statCellActive: { backgroundColor: Colors.bg, borderColor: Colors.accent },
  statCellEmpty:  { opacity: 0.4 },
  statValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, color: Colors.text3, marginTop: 2, textAlign: 'center' },

  assetList: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg, padding: 12,
  },
  assetListHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  assetListTitle: { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  assetListClose: { fontSize: 18, color: Colors.text3, padding: 4 },
  assetSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg2, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, marginBottom: 8,
  },
  assetSearch: { flex: 1, paddingVertical: 8, fontSize: 13, color: Colors.text1 },
  assetScroll: { maxHeight: 340 },
  assetEmpty:  { fontSize: 13, color: Colors.text3, textAlign: 'center', paddingVertical: 12 },

  assetItem: {
    flexDirection: 'row', gap: 10,
    backgroundColor: Colors.bg2, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    padding: 10, marginBottom: 6,
  },
  assetIndex: {
    fontSize: 11, color: Colors.text3,
    fontVariant: ['tabular-nums'], minWidth: 20,
    textAlign: 'right', paddingTop: 2,
  },
  assetName:  { fontSize: 12, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
  assetCodes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  badge:      { backgroundColor: Colors.bg3, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:  { fontSize: 10, color: Colors.text3, fontFamily: 'monospace' },

  assetMeta: { gap: 3, marginBottom: 4 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon:  { fontSize: 11, width: 16 },
  metaText:  { fontSize: 11, color: Colors.text2, flex: 1 },

  scanInfo:  { backgroundColor: Colors.bg3, borderRadius: 6, padding: 8, gap: 4, marginTop: 4 },
  scanText:  { fontSize: 11, color: Colors.text3, flex: 1 },
})