// app/session/[id].tsx

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { confirmDialog, notify } from '../../constants/dialog'
import {
  getEmployeeOptions, getLocationOptions, getSessionDetail,
  unscanItem, updateItem,
} from '../../constants/sessionsApi'

import SessionHeader from './../components/session/SessionHeader'
import SessionItemCard from './../components/session/SessionItemCard'
import SessionRelocateModal from './../components/session/SessionRelocateModal'
import SessionTabs from './../components/session/SessionTabs'

import type { Employee, Item, Location, SessionDetail, TabType } from './../components/session/types'

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  // ── Данные ────────────────────────────────────────────────────────────────────
  const [session,   setSession]   = useState<SessionDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('FOUND')
  const [locations, setLocations] = useState<Location[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Relocate ──────────────────────────────────────────────────────────────────
  const [relocateItem,       setRelocateItem]       = useState<Item | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
  const [employeeNote,       setEmployeeNote]       = useState('')
  const [relocating,         setRelocating]         = useState(false)
  const [modalTab,           setModalTab]           = useState<'location' | 'employee'>('location')
  const [search,             setSearch]             = useState('')

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState<number | null>(null)

  // ── Загрузка данных ───────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const s     = await getSessionDetail(id)
      const items: Item[] = s.items ?? []

      setSession({
        id:       s.id,
        name:     s.name,
        status:   s.status,
        location: s.location?.name || '—',
        found:     items.filter(i => i.status === 'FOUND').length,
        notFound:  items.filter(i => i.status === 'NOT_FOUND').length,
        misplaced: items.filter(i => i.status === 'MISPLACED').length,
        pending:   items.filter(i => i.status === 'PENDING').length,
        total: items.length,
        items,
      })

      // выбираем вкладку автоматически только при первой загрузке
      if (!silent) {
        if      (items.some(i => i.status === 'MISPLACED')) setActiveTab('MISPLACED')
        else if (items.some(i => i.status === 'NOT_FOUND')) setActiveTab('NOT_FOUND')
        else                                                 setActiveTab('FOUND')
      }
    } catch {
      if (!silent) notify('Ошибка', 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Автообновление каждые 5 сек когда экран в фокусе
  useFocusEffect(useCallback(() => {
    load()
    intervalRef.current = setInterval(() => load(true), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load]))

  useEffect(() => {
    getLocationOptions().then(setLocations).catch(() => {})
    getEmployeeOptions().then(setEmployees).catch(() => {})
  }, [])

  // ── Relocate ──────────────────────────────────────────────────────────────────
  const openRelocate = (item: Item) => {
    setRelocateItem(item)
    setSelectedLocationId(null)
    setSelectedEmployeeId(null)
    setEmployeeNote('')
    setModalTab('location')
    setSearch('')
  }

  const closeRelocate = () => {
    setRelocateItem(null)
    setSelectedLocationId(null)
    setSelectedEmployeeId(null)
    setEmployeeNote('')
    setSearch('')
  }

  const handleRelocate = async () => {
    if (!relocateItem) return
    if (!selectedLocationId && !selectedEmployeeId) {
      notify('Выберите', 'Выберите кабинет или сотрудника')
      return
    }
    setRelocating(true)
    try {
      const loc = locations.find(l => l.id === selectedLocationId)
      const emp = employees.find(e => e.id === selectedEmployeeId)
      await updateItem(id, relocateItem.id, {
        ...(loc && { location: loc.name }),
        ...(emp && { employee: emp.fullName }),
      })
      const msg = [
        loc && `Кабинет: ${loc.name}`,
        emp && `Сотрудник: ${emp.fullName}`,
        employeeNote.trim() && `Комментарий: ${employeeNote.trim()}`,
      ].filter(Boolean).join('\n')
      closeRelocate()
      notify('✅ Готово', msg)
      await load(true)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      notify('Ошибка', err.response?.data?.error || 'Не удалось сохранить')
    } finally {
      setRelocating(false)
    }
  }

  // ── Cancel scan ───────────────────────────────────────────────────────────────
  const handleCancelScan = async (item: Item) => {
    const ok = await confirmDialog(
      'Отменить сканирование?',
      `"${item.asset.name}" вернётся в статус "Не проверен"`,
      'Да, отменить',
      { cancelText: 'Нет', destructive: true },
    )
    if (!ok) return
    setCancelling(item.id)
    try {
      await unscanItem(id, item.id)
      await load(true)
    } catch {
      notify('Ошибка', 'Не удалось отменить')
    } finally {
      setCancelling(null)
    }
  }

  // ── Список для активной вкладки ───────────────────────────────────────────────
  const filteredItems = (session?.items.filter(i => i.status === activeTab) ?? [])
    .sort((a, b) => {
      if (!a.scannedAt && !b.scannedAt) return 0
      if (!a.scannedAt) return 1
      if (!b.scannedAt) return -1
      return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
    })

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  )

  if (!session) return null

  // ── Main ──────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <SessionHeader
        session={session}
        onBack={() => router.back()}
        onRefresh={() => load(true)}
      />

      <SessionTabs
        session={session}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'FOUND'     ? '✅' :
               activeTab === 'NOT_FOUND' ? '❌' :
               activeTab === 'MISPLACED' ? '⚠️' : '⏳'}
            </Text>
            <Text style={styles.emptyText}>Нет записей</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionItemCard
            item={item}
            cancelling={cancelling}
            onRelocate={openRelocate}
            onCancel={handleCancelScan}
          />
        )}
      />

      <SessionRelocateModal
        item={relocateItem}
        locations={locations}
        employees={employees}
        selectedLocationId={selectedLocationId}
        selectedEmployeeId={selectedEmployeeId}
        employeeNote={employeeNote}
        relocating={relocating}
        modalTab={modalTab}
        search={search}
        onClose={closeRelocate}
        onConfirm={handleRelocate}
        onTabChange={tab => { setModalTab(tab); setSearch('') }}
        onSearchChange={setSearch}
        onSelectLocation={setSelectedLocationId}
        onSelectEmployee={setSelectedEmployeeId}
        onNoteChange={setEmployeeNote}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty:     { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.text3 },
})
