import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import api from '../../../constants/api'
import { notify } from '../../../constants/dialog'
import { downloadFile } from '../../../constants/download'
import AssetDetailModal from './AssetDetailModal'
import FilterSelect from './FilterSelect'
import { assetMeta, InvAsset } from './inventory'
import { AssetTable, T } from './types'

const PAGE_LIMIT = 50

// «Основные средства» — мобильная версия AssetsAdminPage.jsx
export default function AssetsView() {
  const [tab,         setTab]         = useState<AssetTable>('fixed')
  const [query,       setQuery]       = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [location,    setLocation]    = useState('')
  const [mol,         setMol]         = useState('')
  const [responsible, setResponsible] = useState('')

  const [locations, setLocations] = useState<string[]>([])
  const [molNames,  setMolNames]  = useState<string[]>([])
  const [respNames, setRespNames] = useState<string[]>([])

  const [items,    setItems]    = useState<InvAsset[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [pages,    setPages]    = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<InvAsset | null>(null)

  const reqId = useRef(0)

  useEffect(() => {
    api.get('/inventory/locations')
      .then(r => setLocations(r.data.data || []))
      .catch(() => {})
  }, [])

  // Каскад: список сотрудников зависит от выбранного МОЛ (как в вебе)
  useEffect(() => {
    api.get('/inventory/names', { params: mol ? { mol } : {} })
      .then(r => {
        setMolNames(r.data.data?.mol || [])
        setRespNames(r.data.data?.responsible || [])
      })
      .catch(() => {})
  }, [mol])

  const load = useCallback(async (p: number, append: boolean) => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const res = await api.get('/inventory/assets', {
        params: {
          type: tab,
          location:    location    || undefined,
          mol:         mol         || undefined,
          responsible: responsible || undefined,
          q:           query.trim() || undefined,
          page: p,
          limit: PAGE_LIMIT,
        },
      })
      if (id !== reqId.current) return
      setItems(prev => (append ? [...prev, ...(res.data.data || [])] : (res.data.data || [])))
      setTotal(res.data.total ?? 0)
      setPage(res.data.page ?? p)
      setPages(res.data.pages ?? 1)
    } catch {
      if (id === reqId.current && !append) { setItems([]); setTotal(0) }
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, location, mol, responsible, query])

  // Дебаунс поиска (450мс как в вебе), фильтры — сразу
  useEffect(() => {
    const t = setTimeout(() => load(1, false), query ? 450 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const loadMore = () => {
    if (loading || page >= pages) return
    load(page + 1, true)
  }

  const changeMol = (v: string) => { setMol(v); setResponsible('') }
  const clearFilters = () => { setLocation(''); setMol(''); setResponsible('') }
  const activeFilterCount = [location, mol, responsible].filter(Boolean).length

  const [exporting, setExporting] = useState(false)

  // Акт закрепления ОС по выбранному сотруднику — как в AssetsAdminPage
  const exportAct = async (format: 'single' | 'zip') => {
    if (!responsible || exporting) return
    setExporting(true)
    try {
      const date = new Date().toISOString().slice(0, 10)
      await downloadFile(
        '/inventory/export-act',
        {
          name: responsible,
          format,
          q:        query.trim() || undefined,
          location: location     || undefined,
          mol:      mol          || undefined,
        },
        format === 'zip' ? `act_${responsible}_${date}.zip` : `act_${responsible}_${date}.xlsx`,
      )
    } catch {
      notify('Ошибка', 'Не удалось сформировать акт')
    } finally {
      setExporting(false)
    }
  }

  const renderItem = ({ item, index }: { item: InvAsset; index: number }) => {
    const meta = assetMeta(item.name)
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelected(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardNum}>{index + 1}</Text>
          <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
            <MaterialCommunityIcons name={meta.icon as never} size={14} color={meta.color} />
          </View>
          <Text style={styles.cardName} numberOfLines={2}>{item.name || '—'}</Text>
          <Feather name="chevron-right" size={14} color={T.textFaint} />
        </View>
        <View style={styles.cardBody}>
          {!!item.inventoryNumber && (
            <CardRow label="Инв. номер" value={item.inventoryNumber} mono />
          )}
          {!!item.location?.name && (
            <CardRow label="Местонахождение" value={item.location.name} />
          )}
          {!!item.accountablePerson && <CardRow label="МОЛ" value={item.accountablePerson} />}
          {!!item.person && <CardRow label="Сотрудник" value={item.person} />}
          {!!item.barcode && <CardRow label="Штрих-код" value={item.barcode} mono />}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>Основные средства</Text>
        <Text style={styles.subtitle}>
          {loading && items.length === 0 ? 'Загрузка...' : `Всего: ${total} записей`}
          {pages > 1 && !loading ? ` · стр. ${page} из ${pages}` : ''}
        </Text>
      </View>

      {/* Табы Оборудование / Библиотека */}
      <View style={styles.tabRow}>
        {(['fixed', 'library'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { if (tab !== t) { setTab(t); setItems([]) } }}
            activeOpacity={0.7}
          >
            <Feather
              name={t === 'fixed' ? 'monitor' : 'book-open'}
              size={13}
              color={tab === t ? T.accent : T.textFaint}
            />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'fixed' ? 'Оборудование' : 'Библиотека'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Поиск + кнопка фильтров */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={14} color={T.textFaint} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по наименованию, инв. номеру..."
            placeholderTextColor={T.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')}>
              <Feather name="x" size={12} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, filtersOpen && styles.filterToggleActive]}
          onPress={() => setFiltersOpen(o => !o)}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={14} color={filtersOpen ? T.accent : T.textMuted} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Панель фильтров (как в вебе: помещение, МОЛ, сотрудник — каскад) */}
      {filtersOpen && (
        <View style={styles.filterPanel}>
          <FilterSelect
            value={location} onChange={setLocation}
            options={locations} placeholder="Все помещения" icon="map-pin"
          />
          <FilterSelect
            value={mol} onChange={changeMol}
            options={molNames} placeholder="Все МОЛ" icon="user"
          />
          <FilterSelect
            value={responsible} onChange={setResponsible}
            options={respNames}
            placeholder={mol ? 'Сотрудники выбранного МОЛ' : 'Все сотрудники'}
            icon="users"
          />
          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFilters} onPress={clearFilters}>
              <Feather name="x" size={13} color={T.danger} />
              <Text style={styles.clearFiltersText}>Сбросить фильтры</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Акт закрепления ОС по выбранному сотруднику */}
      {!!responsible && (
        <View style={styles.actRow}>
          <TouchableOpacity
            style={[styles.actBtn, exporting && { opacity: 0.5 }]}
            onPress={() => exportAct('single')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Feather name="file-text" size={12} color={T.accent} />
            <Text style={styles.actText}>{exporting ? 'Формирую…' : 'Акт (Excel)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actBtn, exporting && { opacity: 0.5 }]}
            onPress={() => exportAct('zip')}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Feather name="folder" size={12} color={T.accent} />
            <Text style={styles.actText}>ZIP по кабинетам</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={T.accent} style={{ paddingTop: 48 }} />
          ) : (
            <View style={styles.empty}>
              <Feather name="package" size={32} color={T.textFaint} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>
                {query || activeFilterCount
                  ? 'Ничего не найдено по заданным фильтрам'
                  : 'Нет данных'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length > 0
            ? <ActivityIndicator color={T.accent} style={{ padding: 16 }} />
            : null
        }
      />

      <AssetDetailModal asset={selected} onClose={() => setSelected(null)} />
    </View>
  )
}

function CardRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.cardRow}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text
        style={[styles.cardValue, mono && { fontVariant: ['tabular-nums'] }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header:   { paddingHorizontal: 16, paddingTop: 14 },
  title:    { fontSize: 18, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: T.textFaint, marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tabBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border, paddingVertical: 10,
  },
  tabBtnActive:  { borderColor: T.accentBorder, backgroundColor: T.accentBg },
  tabText:       { fontSize: 12, fontWeight: '600', color: T.textFaint },
  tabTextActive: { color: T.accent },

  searchRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10,
  },
  searchWrap: { flex: 1, position: 'relative' },
  searchIcon: { position: 'absolute', left: 13, top: 13, zIndex: 1 },
  searchInput: {
    backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    color: T.textPrimary, fontSize: 14,
    paddingVertical: 11, paddingLeft: 36, paddingRight: 36,
  },
  clearBtn: {
    position: 'absolute', right: 8, top: 9,
    width: 24, height: 24, borderRadius: 9999,
    backgroundColor: T.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  filterToggle: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterToggleActive: { borderColor: T.accentBorder, backgroundColor: T.accentBg },
  filterBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: T.accent, borderRadius: 9999,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  filterPanel: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  clearFilters: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  clearFiltersText: { fontSize: 13, color: T.danger },

  actRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  actBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 10, paddingVertical: 9,
  },
  actText: { fontSize: 12, fontWeight: '600', color: T.accent },

  list: { padding: 16, gap: 8, paddingBottom: 32 },

  card: {
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, padding: 12,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  cardNum: { fontSize: 11, color: T.textFaint, minWidth: 18, textAlign: 'right' },
  iconWrap: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { flex: 1, fontSize: 14, fontWeight: '600', color: T.textPrimary },

  cardBody: { gap: 4 },
  cardRow:  { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardLabel: { fontSize: 12, color: T.textFaint },
  cardValue: { fontSize: 12, color: T.textSecondary, flexShrink: 1, textAlign: 'right' },

  empty:     { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 13, color: T.textFaint, textAlign: 'center', paddingHorizontal: 32 },
})
