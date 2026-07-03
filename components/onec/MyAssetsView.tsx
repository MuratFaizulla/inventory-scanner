import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, FlatList, Image, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import api from '../../constants/api'
import AssetDetailModal from './AssetDetailModal'
import { assetMeta, InvAsset, photoUri } from './inventory'
import { AssetTable, T } from './types'

// «Оборудование» (моё) — мобильная версия InventoryPage.jsx → PersonalView
export default function MyAssetsView() {
  const [tab,      setTab]      = useState<AssetTable>('fixed')
  const [search,   setSearch]   = useState('')
  const [fixed,    setFixed]    = useState<InvAsset[]>([])
  const [library,  setLibrary]  = useState<InvAsset[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [selected, setSelected] = useState<InvAsset | null>(null)

  useEffect(() => {
    api.get('/inventory/my-assets')
      .then(r => {
        if (r.data?.success === false) {
          setError(r.data.message || 'Нет данных')
          return
        }
        setFixed(r.data.fixedAssets || r.data.assets || [])
        setLibrary(r.data.libraryAssets || [])
      })
      .catch(() => setError('Не удалось загрузить'))
      .finally(() => setLoading(false))
  }, [])

  const assets = tab === 'fixed' ? fixed : library

  // Локальный фильтр как AssetPanel в вебе
  const q = search.toLowerCase()
  const visible = assets.filter(a =>
    !q ||
    (a.name || '').toLowerCase().includes(q) ||
    (a.inventoryNumber || '').toLowerCase().includes(q) ||
    (a.location?.name || '').toLowerCase().includes(q) ||
    (a.sn || '').toLowerCase().includes(q),
  )

  const renderItem = ({ item }: { item: InvAsset }) => {
    const meta = assetMeta(item.name)
    const photo = photoUri(item.photoPath)
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelected(item)}
        activeOpacity={0.7}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.cardImg} resizeMode="contain" />
        ) : (
          <View style={[styles.cardIcon, { backgroundColor: `${meta.color}22` }]}>
            <MaterialCommunityIcons name={meta.icon as never} size={20} color={meta.color} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name || '—'}</Text>
          <View style={styles.cardMeta}>
            {!!item.inventoryNumber && (
              <Text style={styles.cardInv}>{item.inventoryNumber}</Text>
            )}
            {!!item.location?.name && (
              <View style={styles.cardLocRow}>
                <Feather name="map-pin" size={9} color={T.textFaint} />
                <Text style={styles.cardLoc} numberOfLines={1}>{item.location.name}</Text>
              </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={14} color={T.textFaint} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Заголовок как в вебе; экспорт актов — в Настройках */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Оборудование</Text>
          <Text style={styles.subtitle}>Моё оборудование и мебель</Text>
        </View>
      </View>

      {/* Табы с количеством */}
      <View style={styles.tabRow}>
        {(['fixed', 'library'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
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
            <View style={[styles.countBadge, tab === t && styles.countBadgeActive]}>
              <Text style={[styles.countText, tab === t && styles.countTextActive]}>
                {t === 'fixed' ? fixed.length : library.length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Поиск */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={14} color={T.textFaint} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по названию, инв. номеру, кабинету, серийному №..."
          placeholderTextColor={T.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')}>
            <Feather name="x" size={12} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ paddingTop: 48 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Feather name="alert-triangle" size={28} color={T.danger} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i, idx) => String(i.id ?? idx)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={28} color={T.textFaint} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>
                {search ? 'Ничего не найдено' : 'Нет данных'}
              </Text>
            </View>
          }
        />
      )}

      <AssetDetailModal asset={selected} onClose={() => setSelected(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14,
  },
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
  countBadge: {
    backgroundColor: T.elevated, borderRadius: 9999,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  countBadgeActive: { backgroundColor: T.accentBg },
  countText:        { fontSize: 11, fontWeight: '700', color: T.textFaint },
  countTextActive:  { color: T.accent },

  searchWrap: { paddingHorizontal: 16, paddingTop: 10, position: 'relative' },
  searchIcon: { position: 'absolute', left: 29, top: 23, zIndex: 1 },
  searchInput: {
    backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    color: T.textPrimary, fontSize: 13,
    paddingVertical: 11, paddingLeft: 36, paddingRight: 36,
  },
  clearBtn: {
    position: 'absolute', right: 24, top: 19,
    width: 24, height: 24, borderRadius: 9999,
    backgroundColor: T.elevated,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { padding: 16, gap: 8, paddingBottom: 32 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, padding: 12,
  },
  cardImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff' },
  cardIcon: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 14, fontWeight: '600', color: T.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardInv:  { fontSize: 11, color: T.accent, fontVariant: ['tabular-nums'] },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  cardLoc:    { fontSize: 11, color: T.textFaint, flexShrink: 1 },

  empty:     { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 13, color: T.textFaint, textAlign: 'center', paddingHorizontal: 32 },
})
