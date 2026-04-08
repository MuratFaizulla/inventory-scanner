// app/session/[id].tsx

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import api from '../../constants/api'
import { Colors } from '../../constants/colors'

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
      const res   = await api.get(`/inventory/${id}`)
      const s     = res.data
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
      if (!silent) Alert.alert('Ошибка', 'Не удалось загрузить данные')
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
    api.get('/locations').then(r => setLocations(r.data)).catch(() => {})
    api.get('/locations/employees').then(r => setEmployees(r.data)).catch(() => {})
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
    if (!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) {
      Alert.alert('Выберите', 'Выберите кабинет, сотрудника или напишите комментарий')
      return
    }
    setRelocating(true)
    try {
      await api.patch(`/inventory/${id}/asset/${relocateItem.asset.id}/location`, {
        ...(selectedLocationId && { locationId: selectedLocationId }),
        ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
        ...(employeeNote.trim() && { note: employeeNote.trim() }),
      })
      const loc = locations.find(l => l.id === selectedLocationId)
      const emp = employees.find(e => e.id === selectedEmployeeId)
      const msg = [
        loc && `Кабинет: ${loc.name}`,
        emp && `Сотрудник: ${emp.fullName}`,
        employeeNote.trim() && `Комментарий: ${employeeNote.trim()}`,
      ].filter(Boolean).join('\n')
      closeRelocate()
      Alert.alert('✅ Готово', msg)
      await load(true)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить')
    } finally {
      setRelocating(false)
    }
  }

  // ── Cancel scan ───────────────────────────────────────────────────────────────
  const handleCancelScan = (item: Item) => {
    Alert.alert(
      'Отменить сканирование?',
      `"${item.asset.name}" вернётся в статус "Не проверен"`,
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить', style: 'destructive',
          onPress: async () => {
            setCancelling(item.id)
            try {
              await api.patch(`/inventory/${id}/item/${item.id}/cancel`)
              await load(true)
            } catch {
              Alert.alert('Ошибка', 'Не удалось отменить')
            } finally {
              setCancelling(null)
            }
          },
        },
      ]
    )
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






// import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
// import { useCallback, useEffect, useRef, useState } from 'react'
// import {
//   ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
//   ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
// } from 'react-native'
// import api from '../../constants/api'
// import { Colors } from '../../constants/colors'

// type TabType = 'FOUND' | 'NOT_FOUND' | 'MISPLACED' | 'PENDING'

// interface Item {
//   id: number
//   status: string
//   note: string | null
//   scannedAt: string | null
//   scannedBy: string | null
//   asset: {
//     id: number
//     inventoryNumber: string
//     name: string
//     barcode: string | null
//     location: { name: string }
//     responsiblePerson: { fullName: string }
//     employee: { fullName: string } | null
//   }
// }

// interface SessionDetail {
//   id: number
//   name: string
//   status: string
//   location: string
//   found: number
//   notFound: number
//   misplaced: number
//   pending: number
//   total: number
//   items: Item[]
// }

// interface Location { id: number; name: string }
// interface Employee { id: number; fullName: string }

// export default function SessionDetailScreen() {
//   const { id } = useLocalSearchParams<{ id: string }>()
//   const [session, setSession] = useState<SessionDetail | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [activeTab, setActiveTab] = useState<TabType>('FOUND')
//   const [locations, setLocations] = useState<Location[]>([])
//   const [employees, setEmployees] = useState<Employee[]>([])

//   const [relocateItem, setRelocateItem] = useState<Item | null>(null)
//   const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
//   const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
//   const [employeeNote, setEmployeeNote] = useState('')
//   const [relocating, setRelocating] = useState(false)
//   const [modalTab, setModalTab] = useState<'location' | 'employee'>('location')
//   const [search, setSearch] = useState('')
//   const [cancelling, setCancelling] = useState<number | null>(null)

//   const router = useRouter()
//   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

//   const load = useCallback(async (silent = false) => {
//     if (!silent) setLoading(true)
//     try {
//       const res = await api.get(`/inventory/${id}`)
//       const s = res.data
//       const items: Item[] = s.items ?? []
//       setSession({
//         id: s.id, name: s.name, status: s.status,
//         location: s.location?.name || '—',
//         found:     items.filter(i => i.status === 'FOUND').length,
//         notFound:  items.filter(i => i.status === 'NOT_FOUND').length,
//         misplaced: items.filter(i => i.status === 'MISPLACED').length,
//         pending:   items.filter(i => i.status === 'PENDING').length,
//         total: items.length, items,
//       })
//       if (!silent) {
//         if (items.some(i => i.status === 'MISPLACED')) setActiveTab('MISPLACED')
//         else if (items.some(i => i.status === 'NOT_FOUND')) setActiveTab('NOT_FOUND')
//         else setActiveTab('FOUND')
//       }
//     } catch {
//       if (!silent) Alert.alert('Ошибка', 'Не удалось загрузить данные')
//     } finally {
//       setLoading(false)
//     }
//   }, [id])

//   useFocusEffect(useCallback(() => {
//     load()
//     intervalRef.current = setInterval(() => load(true), 5000)
//     return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
//   }, [load]))

//   useEffect(() => {
//     api.get('/locations').then(r => setLocations(r.data)).catch(() => {})
//     api.get('/locations/employees').then(r => setEmployees(r.data)).catch(() => {})
//   }, [])

//   const openRelocateModal = (item: Item) => {
//     setRelocateItem(item); setSelectedLocationId(null)
//     setSelectedEmployeeId(null); setEmployeeNote('')
//     setModalTab('location'); setSearch('')
//   }

//   const closeRelocateModal = () => {
//     setRelocateItem(null); setSelectedLocationId(null)
//     setSelectedEmployeeId(null); setEmployeeNote(''); setSearch('')
//   }

//   const handleRelocate = async () => {
//     if (!relocateItem) return
//     if (!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) {
//       Alert.alert('Выберите', 'Выберите кабинет, сотрудника или напишите комментарий')
//       return
//     }
//     setRelocating(true)
//     try {
//       await api.patch(`/inventory/${id}/asset/${relocateItem.asset.id}/location`, {
//         ...(selectedLocationId && { locationId: selectedLocationId }),
//         ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
//         ...(employeeNote.trim() && { note: employeeNote.trim() }),
//       })
//       const loc = locations.find(l => l.id === selectedLocationId)
//       const emp = employees.find(e => e.id === selectedEmployeeId)
//       const msg = [
//         loc && `Кабинет: ${loc.name}`,
//         emp && `Сотрудник: ${emp.fullName}`,
//         employeeNote.trim() && `Комментарий: ${employeeNote.trim()}`,
//       ].filter(Boolean).join('\n')
//       closeRelocateModal()
//       Alert.alert('✅ Готово', msg)
//       await load(true)
//     } catch (e: unknown) {
//       const err = e as { response?: { data?: { error?: string } } }
//       Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить')
//     } finally {
//       setRelocating(false)
//     }
//   }

//   const handleCancelScan = (item: Item) => {
//     Alert.alert('Отменить сканирование?', `"${item.asset.name}" вернётся в статус "Не проверен"`, [
//       { text: 'Нет', style: 'cancel' },
//       {
//         text: 'Да, отменить', style: 'destructive',
//         onPress: async () => {
//           setCancelling(item.id)
//           try {
//             await api.patch(`/inventory/${id}/item/${item.id}/cancel`)
//             await load(true)
//           } catch {
//             Alert.alert('Ошибка', 'Не удалось отменить')
//           } finally {
//             setCancelling(null)
//           }
//         }
//       }
//     ])
//   }

//   const filteredItems = (session?.items.filter(i => i.status === activeTab) ?? [])
//     .sort((a, b) => {
//       if (!a.scannedAt && !b.scannedAt) return 0
//       if (!a.scannedAt) return 1
//       if (!b.scannedAt) return -1
//       return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
//     })

//   const filteredLocations = locations
//     .filter(l => l.name !== relocateItem?.asset.location.name)
//     .filter(l => l.name.toLowerCase().includes(search.toLowerCase()))

//   const filteredEmployees = employees
//     .filter(e => e.fullName.toLowerCase().includes(search.toLowerCase()))

//   const fmtTime = (d: string | null) =>
//     d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'

//   if (loading) return (
//     <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
//   )
//   if (!session) return null

//   const tabs: { key: TabType; label: string; color: string; count: number }[] = [
//     { key: 'FOUND',     label: '✅ Найден',      color: Colors.accent2, count: session.found },
//     { key: 'NOT_FOUND', label: '❌ Не найден',   color: Colors.danger,  count: session.notFound },
//     { key: 'MISPLACED', label: '⚠️ Место',       color: Colors.warn,    count: session.misplaced },
//     { key: 'PENDING',   label: '⏳ Не проверен', color: Colors.text3,   count: session.pending },
//   ]

//   const isConfirmDisabled = !selectedLocationId && !selectedEmployeeId && !employeeNote.trim()

//   return (
//     <View style={styles.container}>

//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
//           <Text style={styles.backText}>←</Text>
//         </TouchableOpacity>
//         <View style={{ flex: 1 }}>
//           <Text style={styles.headerTitle} numberOfLines={1}>{session.name}</Text>
//           <Text style={styles.headerSub}>📍 {session.location} · {session.total} ОС</Text>
//         </View>
//         <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
//           <Text style={styles.refreshText}>🔄</Text>
//         </TouchableOpacity>
//       </View>

//       <View style={styles.statsRow}>
//         {[
//           { label: 'Всего', value: session.total,     color: Colors.text2   },
//           { label: '✅',    value: session.found,     color: Colors.accent2 },
//           { label: '❌',    value: session.notFound,  color: Colors.danger  },
//           { label: '⚠️',   value: session.misplaced, color: Colors.warn    },
//           { label: '⏳',   value: session.pending,   color: Colors.text3   },
//         ].map(s => (
//           <View key={s.label} style={styles.statBox}>
//             <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
//             <Text style={styles.statLabel}>{s.label}</Text>
//           </View>
//         ))}
//       </View>

//       <View style={styles.tabs}>
//         {tabs.map(t => (
//           <TouchableOpacity
//             key={t.key}
//             style={[styles.tab, activeTab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
//             onPress={() => setActiveTab(t.key)}
//           >
//             <Text style={[styles.tabText, { color: activeTab === t.key ? t.color : Colors.text3 }]}>{t.label}</Text>
//             <Text style={[styles.tabCount, { color: activeTab === t.key ? t.color : Colors.text3 }]}>{t.count}</Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <FlatList
//         data={filteredItems}
//         keyExtractor={i => String(i.id)}
//         contentContainerStyle={{ padding: 12, gap: 8 }}
//         keyboardShouldPersistTaps="handled"
//         ListEmptyComponent={
//           <View style={styles.empty}>
//             <Text style={styles.emptyIcon}>
//               {activeTab === 'FOUND' ? '✅' : activeTab === 'NOT_FOUND' ? '❌' : activeTab === 'MISPLACED' ? '⚠️' : '⏳'}
//             </Text>
//             <Text style={styles.emptyText}>Нет записей</Text>
//           </View>
//         }
//         renderItem={({ item }) => (
//           <View style={[styles.card, {
//             borderLeftWidth: 3,
//             borderLeftColor:
//               item.status === 'FOUND' ? Colors.accent2 :
//               item.status === 'NOT_FOUND' ? Colors.danger :
//               item.status === 'MISPLACED' ? Colors.warn : Colors.border,
//           }]}>
//             <Text style={styles.assetName} numberOfLines={2}>{item.asset.name}</Text>
//             <Text style={styles.invNum}>{item.asset.inventoryNumber}</Text>
//             {item.asset.barcode && <Text style={styles.barcode}>📊 {item.asset.barcode}</Text>}
//             <View style={styles.divider} />
//             <InfoRow icon="📍" value={item.asset.location.name} />
//             <InfoRow icon="👤" value={item.asset.responsiblePerson.fullName} />
//             {item.asset.employee && <InfoRow icon="🧑‍💼" value={item.asset.employee.fullName} />}
//             {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
//             <View style={styles.cardFooter}>
//               {item.scannedBy ? <Text style={styles.scannedBy}>🔍 {item.scannedBy}</Text> : <View />}
//               <Text style={styles.scannedAt}>{fmtTime(item.scannedAt)}</Text>
//             </View>
//             {item.status !== 'PENDING' && (
//               <View style={styles.actionRow}>
//                 <TouchableOpacity style={styles.editBtn} onPress={() => openRelocateModal(item)}>
//                   <Text style={styles.editBtnText}>✏️ Изменить</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   style={styles.cancelBtn}
//                   onPress={() => handleCancelScan(item)}
//                   disabled={cancelling === item.id}
//                 >
//                   <Text style={styles.cancelBtnText}>{cancelling === item.id ? '...' : '✕ Отменить'}</Text>
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>
//         )}
//       />

//       <Modal visible={!!relocateItem} transparent animationType="slide">
//         <KeyboardAvoidingView
//           style={styles.modalOverlay}
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
//         >
//           <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeRelocateModal} />
//           <View style={styles.modal}>
//             <Text style={styles.modalTitle}>✏️ Изменить данные ОС</Text>
//             {relocateItem && (
//               <View style={styles.modalAssetInfo}>
//                 <Text style={styles.modalAssetName} numberOfLines={2}>{relocateItem.asset.name}</Text>
//                 <Text style={styles.modalAssetInv}>{relocateItem.asset.inventoryNumber}</Text>
//                 <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
//                   <Text style={styles.modalAssetMeta}>📍 {relocateItem.asset.location.name}</Text>
//                   {relocateItem.asset.employee && (
//                     <Text style={styles.modalAssetMeta}>🧑‍💼 {relocateItem.asset.employee.fullName.split(' ')[0]}</Text>
//                   )}
//                 </View>
//               </View>
//             )}
//             <View style={styles.modalTabs}>
//               <TouchableOpacity
//                 style={[styles.modalTab, modalTab === 'location' && styles.modalTabActive]}
//                 onPress={() => { setModalTab('location'); setSearch('') }}
//               >
//                 <Text style={[styles.modalTabText, modalTab === 'location' && { color: Colors.accent }]}>
//                   📍 Кабинет {selectedLocationId ? '✓' : ''}
//                 </Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={[styles.modalTab, modalTab === 'employee' && styles.modalTabActive]}
//                 onPress={() => { setModalTab('employee'); setSearch('') }}
//               >
//                 <Text style={[styles.modalTabText, modalTab === 'employee' && { color: Colors.accent }]}>
//                   🧑‍💼 Сотрудник {selectedEmployeeId || employeeNote.trim() ? '✓' : ''}
//                 </Text>
//               </TouchableOpacity>
//             </View>
//             <TextInput
//               style={styles.searchInput}
//               value={search}
//               onChangeText={setSearch}
//               placeholder={modalTab === 'location' ? 'Поиск кабинета...' : 'Поиск сотрудника...'}
//               placeholderTextColor={Colors.text3}
//             />
//             <ScrollView style={styles.locationList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
//               {modalTab === 'location'
//                 ? filteredLocations.map(l => (
//                     <TouchableOpacity
//                       key={l.id}
//                       style={[styles.listItem, selectedLocationId === l.id && styles.listItemSelected]}
//                       onPress={() => setSelectedLocationId(selectedLocationId === l.id ? null : l.id)}
//                     >
//                       <Text style={[styles.listItemText, selectedLocationId === l.id && { color: Colors.accent2, fontWeight: '700' }]}>
//                         {selectedLocationId === l.id ? '✓ ' : ''}{l.name}
//                       </Text>
//                     </TouchableOpacity>
//                   ))
//                 : filteredEmployees.map(e => (
//                     <TouchableOpacity
//                       key={e.id}
//                       style={[styles.listItem, selectedEmployeeId === e.id && styles.listItemSelectedEmp]}
//                       onPress={() => setSelectedEmployeeId(selectedEmployeeId === e.id ? null : e.id)}
//                     >
//                       <Text style={[styles.listItemText, selectedEmployeeId === e.id && { color: Colors.accent, fontWeight: '700' }]}>
//                         {selectedEmployeeId === e.id ? '✓ ' : ''}{e.fullName}
//                       </Text>
//                     </TouchableOpacity>
//                   ))
//               }
//             </ScrollView>
//             {modalTab === 'employee' && (
//               <View style={styles.noteInputWrap}>
//                 <Text style={styles.noteInputLabel}>✏️ Нет в списке? Напишите вручную:</Text>
//                 <TextInput
//                   style={styles.noteInput}
//                   value={employeeNote}
//                   onChangeText={setEmployeeNote}
//                   placeholder="Например: Иванов И.И., каб. 305"
//                   placeholderTextColor={Colors.text3}
//                   multiline numberOfLines={2} scrollEnabled
//                 />
//               </View>
//             )}
//             {(selectedLocationId || selectedEmployeeId || employeeNote.trim()) && (
//               <View style={styles.selectedSummary}>
//                 {selectedLocationId && (
//                   <Text style={styles.selectedText}>📍 → {locations.find(l => l.id === selectedLocationId)?.name}</Text>
//                 )}
//                 {selectedEmployeeId && (
//                   <Text style={styles.selectedTextEmp}>🧑‍💼 → {employees.find(e => e.id === selectedEmployeeId)?.fullName}</Text>
//                 )}
//                 {employeeNote.trim() && !selectedEmployeeId && (
//                   <Text style={styles.selectedTextNote}>✏️ {employeeNote.trim()}</Text>
//                 )}
//               </View>
//             )}
//             <View style={styles.modalNote}>
//               <Text style={styles.modalNoteText}>⚠️ Только в примечание. Обновите в 1С вручную.</Text>
//             </View>
//             <View style={styles.modalBtnRow}>
//               <TouchableOpacity style={styles.modalCancelBtn} onPress={closeRelocateModal}>
//                 <Text style={styles.modalCancelText}>Отмена</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={[styles.modalConfirmBtn, (isConfirmDisabled || relocating) && styles.btnDisabled]}
//                 onPress={handleRelocate}
//                 disabled={isConfirmDisabled || relocating}
//               >
//                 <Text style={styles.modalConfirmText}>{relocating ? 'Сохраняем...' : '✅ Сохранить'}</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>
//     </View>
//   )
// }

// function InfoRow({ icon, value }: { icon: string; value: string }) {
//   return (
//     <View style={infoStyles.row}>
//       <Text style={infoStyles.icon}>{icon}</Text>
//       <Text style={infoStyles.value} numberOfLines={2}>{value}</Text>
//     </View>
//   )
// }

// const infoStyles = StyleSheet.create({
//   row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
//   icon: { fontSize: 12, width: 18 },
//   value: { fontSize: 12, color: Colors.text2, flex: 1 },
// })

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: Colors.bg },
//   center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
//   header: {
//     flexDirection: 'row', alignItems: 'center', gap: 10,
//     paddingHorizontal: 16, paddingVertical: 12,
//     backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border,
//   },
//   backBtn: { padding: 4 },
//   backText: { fontSize: 24, color: Colors.accent },
//   headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
//   headerSub: { fontSize: 11, color: Colors.text3, marginTop: 2 },
//   refreshBtn: { padding: 8 },
//   refreshText: { fontSize: 18 },
//   statsRow: {
//     flexDirection: 'row', backgroundColor: Colors.bg2,
//     paddingVertical: 10, paddingHorizontal: 8,
//     borderBottomWidth: 1, borderBottomColor: Colors.border,
//   },
//   statBox: { flex: 1, alignItems: 'center' },
//   statValue: { fontSize: 18, fontWeight: '700' },
//   statLabel: { fontSize: 10, color: Colors.text3, marginTop: 2 },
//   tabs: { flexDirection: 'row', backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border },
//   tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
//   tabText: { fontSize: 9, fontWeight: '600' },
//   tabCount: { fontSize: 16, fontWeight: '700', marginTop: 2 },
//   empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
//   emptyIcon: { fontSize: 40 },
//   emptyText: { fontSize: 14, color: Colors.text3 },
//   card: { backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14 },
//   assetName: { fontSize: 13, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
//   invNum: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 2 },
//   barcode: { fontSize: 11, color: Colors.text3, marginBottom: 8 },
//   divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
//   note: { fontSize: 11, color: Colors.warn, marginTop: 4 },
//   cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
//   scannedBy: { fontSize: 11, color: Colors.text3 },
//   scannedAt: { fontSize: 11, color: Colors.text3 },
//   actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
//   editBtn: { flex: 1, backgroundColor: '#0c2a4a', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1e4a7a' },
//   editBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
//   cancelBtn: { flex: 1, backgroundColor: '#2a0a0a', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#4a1a1a' },
//   cancelBtnText: { color: Colors.danger, fontSize: 12, fontWeight: '600' },
//   modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
//   modal: { backgroundColor: Colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
//   modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text1, marginBottom: 12 },
//   modalAssetInfo: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginBottom: 12 },
//   modalAssetName: { fontSize: 14, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
//   modalAssetInv: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace' },
//   modalAssetMeta: { fontSize: 11, color: Colors.text3 },
//   modalTabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
//   modalTab: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
//   modalTabActive: { borderColor: Colors.accent, backgroundColor: '#0c2a4a' },
//   modalTabText: { fontSize: 13, color: Colors.text2, fontWeight: '600' },
//   searchInput: { backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, color: Colors.text1, fontSize: 14, padding: 10, marginBottom: 8 },
//   locationList: { maxHeight: 180, marginBottom: 8 },
//   listItem: { padding: 12, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
//   listItemSelected: { backgroundColor: '#0c2a1a', borderColor: Colors.accent2 },
//   listItemSelectedEmp: { backgroundColor: '#0c1a2a', borderColor: Colors.accent },
//   listItemText: { fontSize: 13, color: Colors.text1 },
//   noteInputWrap: { marginBottom: 8 },
//   noteInputLabel: { fontSize: 11, color: Colors.text3, marginBottom: 6, fontWeight: '500' },
//   noteInput: { backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, color: Colors.text1, fontSize: 13, padding: 10, minHeight: 52, textAlignVertical: 'top' },
//   selectedSummary: { backgroundColor: '#0c2a1a', borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
//   selectedText: { fontSize: 12, color: Colors.accent2, fontWeight: '600' },
//   selectedTextEmp: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
//   selectedTextNote: { fontSize: 12, color: Colors.warn, fontWeight: '600' },
//   modalNote: { backgroundColor: '#451a0322', borderRadius: 8, padding: 8, marginBottom: 12 },
//   modalNoteText: { fontSize: 11, color: Colors.warn },
//   modalBtnRow: { flexDirection: 'row', gap: 10 },
//   modalCancelBtn: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
//   modalCancelText: { color: Colors.text2, fontWeight: '600' },
//   modalConfirmBtn: { flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#166534' },
//   modalConfirmText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
//   btnDisabled: { opacity: 0.4 },
// })

