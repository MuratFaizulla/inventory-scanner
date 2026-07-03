import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, FlatList, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import api from '../../../constants/api'
import { confirmDialog, notify } from '../../../constants/dialog'
import AssetDetailModal from './AssetDetailModal'
import FilterSelect from './FilterSelect'
import { assetMeta, AssetType, InvAsset, photoUri, TypeDetail } from './inventory'
import { AssetTable, T } from './types'

// ── Карточка вида (сетка 2 колонки) — как TypeCard в AssetTypesPage.jsx ─────

function TypeCard({ type, ver, onPress }: {
  type: AssetType
  ver: number
  onPress: () => void
}) {
  const meta = assetMeta(type.name)
  const [imgError, setImgError] = useState(false)
  const base = photoUri(type.photoPath)
  const photo = base ? `${base}&t=${ver}` : null
  const showPhoto = !!photo && !imgError

  return (
    <TouchableOpacity style={styles.typeCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[
        styles.typeMedia,
        { backgroundColor: showPhoto ? '#fff' : `${meta.color}18` },
      ]}>
        {showPhoto ? (
          <Image
            source={{ uri: photo }}
            style={styles.typeImg}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <MaterialCommunityIcons name={meta.icon as never} size={44} color={meta.color} />
        )}
      </View>
      <View style={styles.typeBody}>
        <Text style={styles.typeName} numberOfLines={2}>{type.name}</Text>
        <View style={styles.typeMeta}>
          {!!type.topLocation && (
            <View style={styles.typeLocRow}>
              <Feather name="map-pin" size={9} color={T.textFaint} />
              <Text style={styles.typeLoc} numberOfLines={1}>{type.topLocation}</Text>
            </View>
          )}
          {type.locationCount > 1 && (
            <Text style={styles.typeRooms}>в {type.locationCount} помещ.</Text>
          )}
        </View>
        <View style={styles.typeFooter}>
          <Text style={styles.typeQty}>{type.total.toLocaleString('ru')}</Text>
          <Text style={styles.typeQtyLabel}>шт.</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Детали вида — как TypeDetailPage.jsx: hero с фото, статы, помещения ─────
// Фото типа = фото первой единицы вида (та же логика, что в вебе):
// загрузка идёт в assets[0], показывается/удаляется у той единицы, где оно есть.

function TypeDetailModal({ name, tab, ver, onClose, onPhotoChanged }: {
  name: string | null
  tab: AssetTable
  ver: number
  onClose: () => void
  onPhotoChanged: () => void
}) {
  const [data,      setData]      = useState<TypeDetail | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [asset,     setAsset]     = useState<InvAsset | null>(null)
  const [room,      setRoom]      = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [lightbox,  setLightbox]  = useState(false)

  const load = useCallback(() => {
    if (!name) { setData(null); return }
    setLoading(true)
    api.get('/inventory/type-assets', { params: { name, tab } })
      .then(r => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [name, tab])

  useEffect(() => { setRoom(null); load() }, [load])

  const meta = assetMeta(name)
  const typePhotoPath = data?.assets.find(a => a.photoPath)?.photoPath || null
  const heroPhoto = typePhotoPath ? `${photoUri(typePhotoPath)}&t=${ver}` : null
  const personCount = data
    ? new Set(data.assets.map(a => a.person).filter(Boolean)).size
    : 0
  const roomAssets = room && data
    ? data.assets.filter(a => (a.location?.name || '—') === room)
    : []
  const maxRoomCount = data
    ? Math.max(...data.byLocation.map(l => l.count), 1)
    : 1

  const uploadPhoto = async () => {
    if (!data?.assets[0]?.id || photoBusy) return
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (res.canceled) return
    const a = res.assets[0]

    const fd = new FormData()
    if (Platform.OS === 'web') {
      // на вебе uri — blob/data URL, превращаем в File
      const blob = await (await fetch(a.uri)).blob()
      fd.append('photo', new File(
        [blob],
        a.fileName || 'photo.jpg',
        { type: a.mimeType || blob.type || 'image/jpeg' },
      ))
    } else {
      fd.append('photo', {
        uri: a.uri,
        name: a.fileName || 'photo.jpg',
        type: a.mimeType || 'image/jpeg',
      } as never)
    }

    setPhotoBusy(true)
    try {
      await api.post(`/inventory/asset/${data.assets[0].id}/photo`, fd, {
        params: { tab },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onPhotoChanged()
      load()
    } catch {
      notify('Ошибка', 'Не удалось загрузить фото')
    } finally {
      setPhotoBusy(false)
    }
  }

  const deletePhoto = async () => {
    const withPhoto = data?.assets.find(a => a.photoPath)
    if (!withPhoto || photoBusy) return
    const ok = await confirmDialog(
      'Удалить фото типа?',
      'Фото исчезнет с карточки этого вида ОС',
      'Удалить',
      { destructive: true },
    )
    if (!ok) return
    setPhotoBusy(true)
    try {
      await api.delete(`/inventory/asset/${withPhoto.id}/photo`, { params: { tab } })
      onPhotoChanged()
      load()
    } catch {
      notify('Ошибка', 'Не удалось удалить фото')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <Modal visible={!!name} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Шапка */}
          <View style={styles.cardHead}>
            {room ? (
              <TouchableOpacity style={styles.backRow} onPress={() => setRoom(null)}>
                <Feather name="chevron-left" size={17} color={T.accent} />
                <Text style={styles.backText}>Помещения</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={15} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={T.accent} style={{ padding: 40 }} />
          ) : !data ? (
            <Text style={styles.emptyText}>Не удалось загрузить</Text>
          ) : room ? (

            /* ── Помещение: единицы внутри ── */
            <>
              <View style={styles.roomHead}>
                <View style={[styles.roomHeadIcon, { backgroundColor: `${meta.color}18` }]}>
                  <Feather name="map-pin" size={15} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomHeadName} numberOfLines={2}>{room}</Text>
                  <Text style={styles.roomHeadSub}>{roomAssets.length} ед. в этом помещении</Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {roomAssets.map((a, i) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.unitRow}
                    onPress={() => setAsset(a)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.unitNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitInv}>{a.inventoryNumber || 'без инв. №'}</Text>
                      {!!a.person && (
                        <Text style={styles.unitPerson} numberOfLines={1}>{a.person}</Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={14} color={T.textFaint} />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 16 }} />
              </ScrollView>
            </>

          ) : (

            /* ── Главный экран вида ── */
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Фото / иконка */}
              <TouchableOpacity
                style={[
                  styles.hero,
                  { backgroundColor: heroPhoto ? '#fff' : `${meta.color}14` },
                ]}
                activeOpacity={0.85}
                disabled={!heroPhoto}
                onPress={() => setLightbox(true)}
              >
                {heroPhoto ? (
                  <Image source={{ uri: heroPhoto }} style={styles.heroImg} resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name={meta.icon as never} size={56} color={meta.color} />
                )}
                {!!heroPhoto && (
                  <View style={styles.zoomHint}>
                    <Feather name="maximize-2" size={11} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Статы */}
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Feather name="package" size={11} color={T.accent} />
                  <Text style={styles.chipText}>{data.total.toLocaleString('ru')} шт.</Text>
                </View>
                <View style={styles.chip}>
                  <Feather name="map-pin" size={11} color={T.accent} />
                  <Text style={styles.chipText}>{data.locationCount} помещ.</Text>
                </View>
                {personCount > 0 && (
                  <View style={styles.chip}>
                    <Feather name="user" size={11} color={T.accent} />
                    <Text style={styles.chipText}>{personCount} сотр.</Text>
                  </View>
                )}
              </View>

              {/* Управление фото */}
              <View style={styles.photoBtnRow}>
                <TouchableOpacity
                  style={[styles.photoBtn, photoBusy && { opacity: 0.5 }]}
                  onPress={uploadPhoto}
                  disabled={photoBusy}
                  activeOpacity={0.7}
                >
                  <Feather name="image" size={13} color={T.accent} />
                  <Text style={styles.photoBtnText}>
                    {photoBusy ? 'Загрузка…' : typePhotoPath ? 'Заменить фото' : 'Добавить фото'}
                  </Text>
                </TouchableOpacity>
                {!!typePhotoPath && (
                  <TouchableOpacity
                    style={[styles.photoDelBtn, photoBusy && { opacity: 0.5 }]}
                    onPress={deletePhoto}
                    disabled={photoBusy}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={13} color={T.danger} />
                    <Text style={styles.photoDelText}>Удалить</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Помещения */}
              <Text style={styles.sectionTitle}>Помещения</Text>
              {data.byLocation.map(l => {
                const pct = Math.max(Math.round((l.count / maxRoomCount) * 100), 5)
                return (
                  <TouchableOpacity
                    key={l.location}
                    style={styles.roomRow}
                    onPress={() => setRoom(l.location)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roomIcon, { backgroundColor: `${meta.color}18` }]}>
                      <Feather name="map-pin" size={12} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName} numberOfLines={1}>{l.location}</Text>
                      <View style={styles.roomBar}>
                        <View style={[styles.roomBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                      </View>
                    </View>
                    <Text style={styles.roomCount}>{l.count}</Text>
                    <Feather name="chevron-right" size={14} color={T.textFaint} />
                  </TouchableOpacity>
                )
              })}
              <View style={{ height: 16 }} />
            </ScrollView>
          )}
        </View>
      </View>

      {/* Полноэкранный просмотр фото */}
      <Modal visible={lightbox} animationType="fade" transparent onRequestClose={() => setLightbox(false)}>
        <TouchableOpacity
          style={styles.lightbox}
          activeOpacity={1}
          onPress={() => setLightbox(false)}
        >
          {!!heroPhoto && (
            <Image source={{ uri: heroPhoto }} style={styles.lightboxImg} resizeMode="contain" />
          )}
          <View style={styles.lightboxClose}>
            <Feather name="x" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>

      <AssetDetailModal asset={asset} onClose={() => setAsset(null)} />
    </Modal>
  )
}

// ── Страница «Виды ОС» — как AssetTypesPage.jsx ─────────────────────────────

export default function TypesView() {
  const [tab,         setTab]         = useState<AssetTable>('fixed')
  const [query,       setQuery]       = useState('')
  const [mol,         setMol]         = useState('')
  const [sotrudnik,   setSotrudnik]   = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [types,   setTypes]   = useState<AssetType[]>([])
  const [loading, setLoading] = useState(false)
  const [molList, setMolList] = useState<string[]>([])
  const [sotList, setSotList] = useState<string[]>([])
  const [opened,  setOpened]  = useState<string | null>(null)
  // Версия фото — меняется после загрузки/удаления, сбрасывает кэш картинок
  const [photoVer, setPhotoVer] = useState(0)

  const reqId = useRef(0)

  useEffect(() => {
    api.get('/inventory/names')
      .then(r => {
        const sort = (a: string, b: string) => a.localeCompare(b, 'ru')
        setMolList([...(r.data.data?.mol || [])].sort(sort))
        setSotList([...(r.data.data?.responsible || [])].sort(sort))
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const res = await api.get('/inventory/types', {
        params: {
          tab,
          q:         query.trim() || undefined,
          mol:       mol          || undefined,
          sotrudnik: sotrudnik    || undefined,
        },
      })
      if (id !== reqId.current) return
      setTypes(res.data.data || [])
    } catch {
      if (id === reqId.current) setTypes([])
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, query, mol, sotrudnik])

  // Дебаунс поиска 350мс как в вебе
  useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const totalAssets = types.reduce((s, t) => s + t.total, 0)
  const activeFilterCount = (mol ? 1 : 0) + (sotrudnik ? 1 : 0)

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>Виды ОС</Text>
        <Text style={styles.subtitle}>
          {loading
            ? '...'
            : `${types.length.toLocaleString('ru')} видов · ${totalAssets.toLocaleString('ru')} штук всего`}
        </Text>
      </View>

      {/* Табы */}
      <View style={styles.tabRow}>
        {(['fixed', 'library'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'fixed' ? 'Оборудование' : 'Библиотека'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Поиск + фильтры */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={14} color={T.textFaint} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по наименованию..."
            placeholderTextColor={T.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')}>
              <Feather name="x" size={12} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {(molList.length > 0 || sotList.length > 0) && (
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
        )}
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          {molList.length > 0 && (
            <FilterSelect value={mol} onChange={setMol}
              options={molList} placeholder="МОЛ (все)" icon="user" />
          )}
          {sotList.length > 0 && (
            <FilterSelect value={sotrudnik} onChange={setSotrudnik}
              options={sotList} placeholder="Сотрудник (все)" icon="user" />
          )}
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearFilters}
              onPress={() => { setMol(''); setSotrudnik('') }}
            >
              <Feather name="x" size={13} color={T.danger} />
              <Text style={styles.clearFiltersText}>Сбросить фильтры</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ paddingTop: 48 }} />
      ) : (
        <FlatList
          data={types}
          keyExtractor={t => t.name}
          renderItem={({ item }) => (
            <TypeCard type={item} ver={photoVer} onPress={() => setOpened(item.name)} />
          )}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>Ничего не найдено</Text>
          }
        />
      )}

      <TypeDetailModal
        name={opened}
        tab={tab}
        ver={photoVer}
        onClose={() => setOpened(null)}
        onPhotoChanged={() => { setPhotoVer(Date.now()); load() }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header:   { paddingHorizontal: 16, paddingTop: 14 },
  title:    { fontSize: 18, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: T.textFaint, marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tabBtn: {
    flex: 1, alignItems: 'center',
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

  grid: { padding: 16, gap: 10, paddingBottom: 32 },

  typeCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: 14,
    borderWidth: 1, borderColor: T.border, overflow: 'hidden',
  },
  typeMedia: {
    height: 110, alignItems: 'center', justifyContent: 'center',
  },
  typeImg:  { width: '100%', height: '100%' },
  typeBody: { padding: 10, gap: 4 },
  typeName: { fontSize: 13, fontWeight: '600', color: T.textPrimary, minHeight: 34 },
  typeMeta: { gap: 2 },
  typeLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeLoc:    { fontSize: 11, color: T.textFaint, flexShrink: 1 },
  typeRooms:  { fontSize: 11, color: T.textFaint },
  typeFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  typeQty:      { fontSize: 18, fontWeight: '700', color: T.accent },
  typeQtyLabel: { fontSize: 11, color: T.textFaint },

  emptyText: {
    fontSize: 13, color: T.textFaint, textAlign: 'center', paddingTop: 40,
  },

  /* Детали вида — карточка по центру */
  overlay: {
    flex: 1, backgroundColor: 'rgba(2,6,23,0.85)',
    justifyContent: 'center', padding: 16,
  },
  card: {
    backgroundColor: T.surface, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
    maxHeight: '88%', padding: 16,
  },
  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: T.textPrimary, flex: 1 },
  closeBtn: {
    backgroundColor: T.elevated, borderRadius: 9999,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: '600', color: T.accent },

  hero: {
    height: 170, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border,
  },
  heroImg: { width: '100%', height: '100%' },
  zoomHint: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(2,6,23,0.55)', borderRadius: 8, padding: 6,
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: T.textSecondary },

  photoBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 10, paddingVertical: 10,
  },
  photoBtnText: { fontSize: 12, fontWeight: '600', color: T.accent },
  photoDelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },
  photoDelText: { fontSize: 12, fontWeight: '600', color: T.danger },

  sectionTitle: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
    color: T.textFaint, fontWeight: '600',
    marginTop: 16, marginBottom: 6,
  },
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: T.borderFaint,
  },
  roomIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  roomName: { fontSize: 13, color: T.textSecondary, marginBottom: 4 },
  roomBar: {
    height: 4, borderRadius: 2, backgroundColor: T.elevated, overflow: 'hidden',
  },
  roomBarFill: { height: '100%', borderRadius: 2 },
  roomCount: { fontSize: 14, fontWeight: '700', color: T.accent, minWidth: 24, textAlign: 'right' },

  roomHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  roomHeadIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  roomHeadName: { fontSize: 14, fontWeight: '700', color: T.textPrimary },
  roomHeadSub:  { fontSize: 11, color: T.textFaint, marginTop: 1 },

  unitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: T.borderFaint,
  },
  unitNum: {
    fontSize: 11, color: T.textFaint, fontVariant: ['tabular-nums'],
    minWidth: 22, textAlign: 'center',
  },
  unitInv:    { fontSize: 13, color: T.textPrimary, fontVariant: ['tabular-nums'] },
  unitPerson: { fontSize: 11, color: T.textFaint, marginTop: 1 },

  /* Лайтбокс */
  lightbox: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  lightboxImg: { width: '100%', height: '85%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 9999, padding: 10,
  },
})
