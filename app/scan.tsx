// app/ScanScreen.tsx

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Keyboard, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, Vibration, View,
} from 'react-native'
import api from '../constants/api'

import CameraScanner from './components/scan/CameraScanner'
import HistoryScreen from './components/scan/HistoryScreen'
import ManualInput from './components/scan/ManualInput'
import RelocateModal from './components/scan/RelocateModal'
import ScanHeader from './components/scan/ScanHeader'
import ScanResultCard from './components/scan/ScanResultCard'
import StatsByLocationScreen from './components/scan/StatsByLocationScreen'

import type { LastRelocate } from './components/scan/RelocateModal'
import type { Employee, HistoryItem, Location, ScanResult, ScanStatus } from './components/scan/types'

let _seq = 0
const uid = () => `${Date.now()}-${++_seq}`

export default function ScanScreen() {
  const { sessionId, sessionName } = useLocalSearchParams<{ sessionId: string; sessionName: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const router       = useRouter()
  const { height: screenHeight } = useWindowDimensions()

  // ── Сканер ────────────────────────────────────────────────────────────────────
  const [result,       setResult]       = useState<ScanResult | null>(null)
  const [scannerName,  setScannerName]  = useState('')
  const [scannedCount, setScannedCount] = useState(0)
  const [showManual,   setShowManual]   = useState(false)
  const [manualInput,  setManualInput]  = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const cooldown    = useRef(false)
  const lastBarcode = useRef<string | null>(null)

  // ── Экраны ────────────────────────────────────────────────────────────────────
  const [showHistory,         setShowHistory]         = useState(false)
  const [showStatsByLocation, setShowStatsByLocation] = useState(false)

  // ── История ───────────────────────────────────────────────────────────────────
  const historyRef = useRef<HistoryItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])

  // ── Relocate ──────────────────────────────────────────────────────────────────
  const [locations,          setLocations]          = useState<Location[]>([])
  const [employees,          setEmployees]          = useState<Employee[]>([])
  const [showRelocate,       setShowRelocate]       = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
  const [employeeNote,       setEmployeeNote]       = useState('')
  const [relocating,         setRelocating]         = useState(false)
  const [modalTab,           setModalTab]           = useState<'location' | 'employee'>('location')
  const [relocateSearch,     setRelocateSearch]     = useState('')

  // ── Последнее перемещение — запоминаем для быстрого применения ───────────────
  const [lastRelocate, setLastRelocate] = useState<LastRelocate | null>(null)

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState(false)

  // ── Клавиатура ────────────────────────────────────────────────────────────────
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    AsyncStorage.getItem('scannerName').then(n => setScannerName(n || ''))
    api.get('/locations').then(r => setLocations(r.data)).catch(() => {})
    api.get('/locations/employees').then(r => setEmployees(r.data)).catch(() => {})
  }, [])

  // ── История ───────────────────────────────────────────────────────────────────
  const addToHistory = useCallback((barcode: string, status: ScanStatus, name: string) => {
    const item: HistoryItem = {
      id: uid(),
      barcode,
      status,
      name,
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    }
    historyRef.current = [item, ...historyRef.current].slice(0, 50)
    setHistory([...historyRef.current])
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    setHistory([])
  }, [])

  // ── Логика сканирования ───────────────────────────────────────────────────────
  const doScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    setSubmitting(true)
    try {
      const res  = await api.post(`/inventory/${sessionId}/scan`, {
        barcode:   barcode.trim(),
        scannedBy: scannerName,
      })
      const data = res.data

      if (data.alreadyScanned) {
        Vibration.vibrate([0, 80, 60, 80])
        setResult({
          status: 'ALREADY',
          asset: {
            id:                data.asset?.id,
            itemId:            data.item?.id,
            inventoryNumber:   data.asset?.inventoryNumber || barcode,
            name:              data.asset?.name || 'Неизвестно',
            barcode:           data.asset?.barcode || null,
            location:          data.asset?.location?.name || '—',
            responsiblePerson: data.asset?.responsiblePerson?.fullName || '—',
            employee:          data.asset?.employee?.fullName || '—',
          },
          previousScan: data.previousScan ?? null,
        })
        addToHistory(barcode, 'ALREADY', data.asset?.name || barcode)
        return
      }

      const status: ScanStatus = (data.status === 'MISPLACED' || data.isWrongLocation)
        ? 'MISPLACED'
        : 'FOUND'

      if (status === 'FOUND') Vibration.vibrate(80)
      else                    Vibration.vibrate([0, 100, 50, 100])

      setResult({
        status,
        asset: {
          id:                data.asset?.id,
          itemId:            data.item?.id,
          inventoryNumber:   data.asset?.inventoryNumber || barcode,
          name:              data.asset?.name || 'Неизвестно',
          barcode:           data.asset?.barcode || null,
          location:          data.asset?.location?.name || '—',
          responsiblePerson: data.asset?.responsiblePerson?.fullName || '—',
          employee:          data.asset?.employee?.fullName || '—',
        },
        expectedLocation: data.expectedLocation || data.asset?.location?.name,
        actualLocation:   data.actualLocation,
      })
      setScannedCount(c => c + 1)
      addToHistory(barcode, status, data.asset?.name || barcode)
    } catch (e: any) {
      if (e.response?.status === 404) {
        Vibration.vibrate([0, 100, 50, 100, 50, 100])
        setResult({ status: 'NOT_FOUND', message: `Не найден: ${barcode}` })
        addToHistory(barcode, 'NOT_FOUND', barcode)
      } else {
        setResult({ status: 'NOT_FOUND', message: e.response?.data?.error || 'Ошибка сервера' })
      }
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, scannerName, addToHistory])

  const handleBarcode = useCallback((data: string) => {
    if (cooldown.current) return
    if (showManual || showHistory || showStatsByLocation || result) return
    if (lastBarcode.current === data) return
    cooldown.current    = true
    lastBarcode.current = data
    doScan(data)
  }, [showManual, showHistory, showStatsByLocation, result, doScan])

  const handleManualSubmit = async () => {
    if (!manualInput.trim() || submitting) return
    Vibration.vibrate(40)
    setShowManual(false)
    await doScan(manualInput.trim())
    setManualInput('')
  }

  const handleNext = () => {
    setResult(null)
    setShowManual(false)
    setShowRelocate(false)
    resetRelocate()
    setTimeout(() => {
      cooldown.current    = false
      lastBarcode.current = null
    }, 600)
  }

  // ── Relocate ──────────────────────────────────────────────────────────────────
  const resetRelocate = () => {
    setSelectedLocationId(null)
    setSelectedEmployeeId(null)
    setEmployeeNote('')
    setRelocateSearch('')
  }

  const openRelocate = () => {
    resetRelocate()
    setModalTab('location')
    setShowRelocate(true)
  }

  // Применить предыдущее перемещение одной кнопкой
  const handleApplyLast = () => {
    if (!lastRelocate) return
    setSelectedLocationId(lastRelocate.locationId)
    setSelectedEmployeeId(lastRelocate.employeeId)
    setEmployeeNote(lastRelocate.employeeNote)
  }

  const handleRelocate = async () => {
    if (!result?.asset) return
    if (!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) {
      Alert.alert('Выберите', 'Выберите кабинет, сотрудника или напишите комментарий')
      return
    }
    setRelocating(true)
    try {
      await api.patch(`/inventory/${sessionId}/asset/${result.asset.id}/location`, {
        ...(selectedLocationId && { locationId: selectedLocationId }),
        ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
        ...(employeeNote.trim() && { note: employeeNote.trim() }),
      })

      const loc = locations.find(l => l.id === selectedLocationId)
      const emp = employees.find(e => e.id === selectedEmployeeId)

      // ── Сохраняем как "последнее перемещение" ──────────────────────────────
      setLastRelocate({
        locationId:   selectedLocationId,
        employeeId:   selectedEmployeeId,
        employeeNote: employeeNote.trim(),
        locationName: loc?.name || '',
        employeeName: emp?.fullName || '',
      })

      const msg = [
        loc && `Кабинет: ${loc.name}`,
        emp && `Сотрудник: ${emp.fullName}`,
        employeeNote.trim() && `Комментарий: ${employeeNote.trim()}`,
      ].filter(Boolean).join('\n')

      setShowRelocate(false)
      resetRelocate()
      Alert.alert('✅ Готово', msg)
      handleNext()
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось переместить')
    } finally {
      setRelocating(false)
    }
  }

  // ── Cancel scan ───────────────────────────────────────────────────────────────
  const handleCancelScan = () => {
    if (!result?.asset?.itemId) return
    Alert.alert(
      'Отменить сканирование?',
      'ОС вернётся в статус "Не проверен"',
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить', style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              await api.patch(`/inventory/${sessionId}/item/${result.asset!.itemId}/cancel`)
              handleNext()
            } catch {
              Alert.alert('Ошибка', 'Не удалось отменить')
            } finally {
              setCancelling(false)
            }
          },
        },
      ]
    )
  }

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>📷 Нужен доступ к камере</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Разрешить</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Вложенные экраны ──────────────────────────────────────────────────────────
  if (showStatsByLocation) return (
    <StatsByLocationScreen
      sessionId={sessionId}
      onBack={() => setShowStatsByLocation(false)}
    />
  )

  if (showHistory) return (
    <HistoryScreen
      history={history}
      onBack={() => setShowHistory(false)}
      onClear={clearHistory}
    />
  )

  // ── Main ──────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScanHeader
        sessionName={sessionName}
        scannerName={scannerName}
        scannedCount={scannedCount}
        historyCount={history.length}
        onBack={() => router.back()}
        onHistory={() => setShowHistory(true)}
        onStats={() => setShowStatsByLocation(true)}
      />

      {!result && !showManual ? (
        <CameraScanner
          submitting={submitting}
          onBarcodeScanned={handleBarcode}
          onManual={() => setShowManual(true)}
        />
      ) : showManual && !result ? (
        <ManualInput
          value={manualInput}
          submitting={submitting}
          onChange={setManualInput}
          onSubmit={handleManualSubmit}
          onCancel={() => { setShowManual(false); setManualInput('') }}
        />
      ) : result ? (
        <ScanResultCard
          result={result}
          cancelling={cancelling}
          onNext={handleNext}
          onNextManual={() => { handleNext(); setShowManual(true) }}
          onRelocate={openRelocate}
          onCancelScan={handleCancelScan}
        />
      ) : null}

      <RelocateModal
        visible={showRelocate}
        asset={result?.asset}
        locations={locations}
        employees={employees}
        selectedLocationId={selectedLocationId}
        selectedEmployeeId={selectedEmployeeId}
        employeeNote={employeeNote}
        relocating={relocating}
        modalTab={modalTab}
        search={relocateSearch}
        keyboardHeight={keyboardHeight}
        screenHeight={screenHeight}
        lastRelocate={lastRelocate}
        onClose={() => { setShowRelocate(false); resetRelocate() }}
        onConfirm={handleRelocate}
        onTabChange={tab => { setModalTab(tab); setRelocateSearch('') }}
        onSearchChange={setRelocateSearch}
        onSelectLocation={setSelectedLocationId}
        onSelectEmployee={setSelectedEmployeeId}
        onNoteChange={setEmployeeNote}
        onApplyLast={handleApplyLast}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center:    { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText:  { fontSize: 16, color: '#f1f5f9', marginBottom: 20, textAlign: 'center' },
  btn:       { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, minWidth: 160, alignItems: 'center' },
  btnText:   { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
})









































// import AsyncStorage from '@react-native-async-storage/async-storage'
// import { CameraView, useCameraPermissions } from 'expo-camera'
// import { useLocalSearchParams, useRouter } from 'expo-router'
// import { useEffect, useRef, useState } from 'react'
// import {
//   Alert,
//   FlatList,
//   Keyboard,
//   KeyboardAvoidingView,
//   Modal,
//   Platform,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   useWindowDimensions,
//   Vibration,
//   View
// } from 'react-native'
// import api from '../constants/api'
// import { Colors } from '../constants/colors'
// import StatsByLocationScreen from './StatsByLocationScreen'; // ← импорт

// type ScanStatus = 'FOUND' | 'MISPLACED' | 'NOT_FOUND' | 'ALREADY'

// type ScannedAsset = {
//   id: number
//   itemId: number
//   inventoryNumber: string
//   name: string
//   barcode: string | null
//   location: string
//   responsiblePerson: string
//   employee: string
// }

// type PreviousScan = {
//   scannedAt: string | null
//   scannedBy: string | null
//   note: string | null
// }

// type ScanResult = {
//   status: ScanStatus
//   asset?: ScannedAsset
//   expectedLocation?: string
//   actualLocation?: string
//   message?: string
//   previousScan?: PreviousScan
// }

// type HistoryItem = {
//   id: string
//   barcode: string
//   status: ScanStatus
//   name: string
//   time: string
// }

// type Location = {
//   id: number
//   name: string
// }

// type Employee = {
//   id: number
//   fullName: string
// }

// export default function ScanScreen() {
//   const { sessionId, sessionName } = useLocalSearchParams<{ sessionId: string; sessionName: string }>()
//   const [permission, requestPermission] = useCameraPermissions()
//   const [result, setResult] = useState<ScanResult | null>(null)
//   const [scannerName, setScannerName] = useState('')
//   const [scannedCount, setScannedCount] = useState(0)
//   const [showManual, setShowManual] = useState(false)
//   const [showHistory, setShowHistory] = useState(false)
//   const [showStatsByLocation, setShowStatsByLocation] = useState(false)  // ← новый стейт
//   const [manualInput, setManualInput] = useState('')
//   const [history, setHistory] = useState<HistoryItem[]>([])
//   const [submitting, setSubmitting] = useState(false)

//   // Relocate
//   const [locations, setLocations] = useState<Location[]>([])
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [showRelocate, setShowRelocate] = useState(false)
//   const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
//   const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
//   const [employeeNote, setEmployeeNote] = useState('')
//   const [relocating, setRelocating] = useState(false)
//   const [modalTab, setModalTab] = useState<'location' | 'employee'>('location')
//   const [search, setSearch] = useState('')

//   // Cancel
//   const [cancelling, setCancelling] = useState(false)

//   const cooldown = useRef(false)
//   const router = useRouter()
//   const { height: screenHeight } = useWindowDimensions()
//   const [keyboardHeight, setKeyboardHeight] = useState(0)

//   useEffect(() => {
//     const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height))
//     const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))
//     return () => { show.remove(); hide.remove() }
//   }, [])

//   useEffect(() => {
//     AsyncStorage.getItem('scannerName').then(n => setScannerName(n || ''))
//     api.get('/locations').then(r => setLocations(r.data)).catch(() => {})
//     api.get('/locations/employees').then(r => setEmployees(r.data)).catch(() => {})
//   }, [])

//   const doScan = async (barcode: string) => {
//     if (!barcode.trim()) return
//     setSubmitting(true)
//     try {
//       const res = await api.post(`/inventory/${sessionId}/scan`, {
//         barcode: barcode.trim(),
//         scannedBy: scannerName,
//       })
//       const data = res.data

//       if (data.alreadyScanned) {
//         Vibration.vibrate([0, 80, 60, 80])
//         setResult({
//           status: 'ALREADY',
//           asset: {
//             id: data.asset?.id,
//             itemId: data.item?.id,
//             inventoryNumber: data.asset?.inventoryNumber || barcode,
//             name: data.asset?.name || 'Неизвестно',
//             barcode: data.asset?.barcode || null,
//             location: data.asset?.location?.name || '—',
//             responsiblePerson: data.asset?.responsiblePerson?.fullName || '—',
//             employee: data.asset?.employee?.fullName || '—',
//           },
//           previousScan: data.previousScan ?? null,
//         })
//         addToHistory(barcode, 'ALREADY', data.asset?.name || barcode)
//         return
//       }

//       let status: ScanStatus = 'FOUND'
//       if (data.status === 'MISPLACED' || data.isWrongLocation) status = 'MISPLACED'

//       if (status === 'FOUND') Vibration.vibrate(80)
//       else Vibration.vibrate([0, 100, 50, 100])

//       setResult({
//         status,
//         asset: {
//           id: data.asset?.id,
//           itemId: data.item?.id,
//           inventoryNumber: data.asset?.inventoryNumber || barcode,
//           name: data.asset?.name || 'Неизвестно',
//           barcode: data.asset?.barcode || null,
//           location: data.asset?.location?.name || '—',
//           responsiblePerson: data.asset?.responsiblePerson?.fullName || '—',
//           employee: data.asset?.employee?.fullName || '—',
//         },
//         expectedLocation: data.expectedLocation || data.asset?.location?.name,
//         actualLocation: data.actualLocation,
//       })
//       setScannedCount(c => c + 1)
//       addToHistory(barcode, status, data.asset?.name || barcode)
//     } catch (e: any) {
//       if (e.response?.status === 404) {
//         Vibration.vibrate([0, 100, 50, 100, 50, 100])
//         setResult({ status: 'NOT_FOUND', message: `Не найден: ${barcode}` })
//         addToHistory(barcode, 'NOT_FOUND', barcode)
//       } else {
//         setResult({ status: 'NOT_FOUND', message: e.response?.data?.error || 'Ошибка сервера' })
//       }
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   const addToHistory = (barcode: string, status: ScanStatus, name: string) => {
//     setHistory(prev => [{
//       id: Date.now().toString(), barcode, status, name,
//       time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
//     }, ...prev].slice(0, 50))
//   }

//   const handleBarcode = async ({ data }: { data: string }) => {
//     if (cooldown.current || showManual || showHistory || showStatsByLocation || result) return
//     cooldown.current = true
//     await doScan(data)
//   }

//   const handleManualSubmit = async () => {
//     if (!manualInput.trim() || submitting) return
//     Vibration.vibrate(40)
//     setShowManual(false)
//     await doScan(manualInput.trim())
//     setManualInput('')
//   }

//   const handleNext = () => {
//     setResult(null)
//     setShowManual(false)
//     setShowRelocate(false)
//     setSelectedLocationId(null)
//     setSelectedEmployeeId(null)
//     setEmployeeNote('')
//     setSearch('')
//     setTimeout(() => { cooldown.current = false }, 500)
//   }

//   const openRelocateModal = () => {
//     setSelectedLocationId(null)
//     setSelectedEmployeeId(null)
//     setEmployeeNote('')
//     setModalTab('location')
//     setSearch('')
//     setShowRelocate(true)
//   }

//   const handleRelocate = async () => {
//     if (!result?.asset) return
//     if (!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) {
//       Alert.alert('Выберите', 'Выберите кабинет, сотрудника или напишите комментарий')
//       return
//     }
//     setRelocating(true)
//     try {
//       await api.patch(
//         `/inventory/${sessionId}/asset/${result.asset.id}/location`,
//         {
//           ...(selectedLocationId && { locationId: selectedLocationId }),
//           ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
//           ...(employeeNote.trim() && { note: employeeNote.trim() }),
//         }
//       )
//       const loc = locations.find(l => l.id === selectedLocationId)
//       const emp = employees.find(e => e.id === selectedEmployeeId)
//       const msg = [
//         loc && `Кабинет: ${loc.name}`,
//         emp && `Сотрудник: ${emp.fullName}`,
//         employeeNote.trim() && `Комментарий: ${employeeNote.trim()}`,
//       ].filter(Boolean).join('\n')

//       setShowRelocate(false)
//       setSelectedLocationId(null)
//       setSelectedEmployeeId(null)
//       setEmployeeNote('')
//       Alert.alert('✅ Готово', msg)
//       handleNext()
//     } catch (e: any) {
//       Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось переместить')
//     } finally {
//       setRelocating(false)
//     }
//   }

//   const handleCancelScan = () => {
//     if (!result?.asset?.itemId) return
//     Alert.alert(
//       'Отменить сканирование?',
//       'ОС вернётся в статус "Не проверен"',
//       [
//         { text: 'Нет', style: 'cancel' },
//         {
//           text: 'Да, отменить',
//           style: 'destructive',
//           onPress: async () => {
//             setCancelling(true)
//             try {
//               await api.patch(`/inventory/${sessionId}/item/${result.asset!.itemId}/cancel`)
//               handleNext()
//             } catch (e: any) {
//               Alert.alert('Ошибка', 'Не удалось отменить')
//             } finally {
//               setCancelling(false)
//             }
//           }
//         }
//       ]
//     )
//   }

//   const filteredLocations = locations
//     .filter(l => l.name !== result?.asset?.location)
//     .filter(l => l.name.toLowerCase().includes(search.toLowerCase()))

//   const filteredEmployees = employees
//     .filter(e => e.fullName.toLowerCase().includes(search.toLowerCase()))

//   const statusColor = (s: ScanStatus) => {
//     if (s === 'FOUND')     return Colors.accent2
//     if (s === 'MISPLACED') return Colors.warn
//     if (s === 'ALREADY')   return '#60a5fa'
//     return Colors.danger
//   }

//   const statusBg = (s: ScanStatus) => {
//     if (s === 'FOUND')     return '#064e3b33'
//     if (s === 'MISPLACED') return '#451a0333'
//     if (s === 'ALREADY')   return '#1e3a5f33'
//     return '#450a0a33'
//   }

//   const statusEmoji = (s: ScanStatus) => {
//     if (s === 'FOUND')     return '✅'
//     if (s === 'MISPLACED') return '⚠️'
//     if (s === 'ALREADY')   return '🔄'
//     return '❌'
//   }

//   const statusLabel = (s: ScanStatus) => {
//     if (s === 'FOUND')     return 'Найден'
//     if (s === 'MISPLACED') return 'Не на месте'
//     if (s === 'ALREADY')   return 'Уже отсканирован'
//     return 'Не найден'
//   }

//   if (!permission) return <View style={styles.container} />

//   if (!permission.granted) {
//     return (
//       <View style={styles.center}>
//         <Text style={styles.permText}>📷 Нужен доступ к камере</Text>
//         <TouchableOpacity style={styles.btn} onPress={requestPermission}>
//           <Text style={styles.btnText}>Разрешить</Text>
//         </TouchableOpacity>
//       </View>
//     )
//   }

//   // ── Экран: прогресс по кабинетам ─────────────────────────────────────────────
//   if (showStatsByLocation) {
//     return (
//       <StatsByLocationScreen
//         sessionId={sessionId}
//         onBack={() => setShowStatsByLocation(false)}
//       />
//     )
//   }

//   // ── Экран: история ───────────────────────────────────────────────────────────
//   if (showHistory) {
//     return (
//       <View style={styles.container}>
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.backBtn}>
//             <Text style={styles.backText}>←</Text>
//           </TouchableOpacity>
//           <View style={{ flex: 1 }}>
//             <Text style={styles.headerTitle}>История сканирования</Text>
//             <Text style={styles.headerSub}>{history.length} записей</Text>
//           </View>
//           {history.length > 0 && (
//             <TouchableOpacity onPress={() => setHistory([])} style={styles.clearBtn}>
//               <Text style={styles.clearBtnText}>Очистить</Text>
//             </TouchableOpacity>
//           )}
//         </View>
//         <FlatList
//           data={history}
//           keyExtractor={i => i.id}
//           contentContainerStyle={{ padding: 12, gap: 8 }}
//           ListEmptyComponent={
//             <View style={styles.empty}><Text style={styles.emptyText}>История пуста</Text></View>
//           }
//           renderItem={({ item }) => (
//             <View style={[styles.historyCard, { borderLeftColor: statusColor(item.status), borderLeftWidth: 3 }]}>
//               <View style={styles.historyRow}>
//                 <Text style={styles.historyEmoji}>{statusEmoji(item.status)}</Text>
//                 <View style={{ flex: 1 }}>
//                   <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
//                   <Text style={styles.historyBarcode}>{item.barcode}</Text>
//                 </View>
//                 <Text style={styles.historyTime}>{item.time}</Text>
//               </View>
//             </View>
//           )}
//         />
//       </View>
//     )
//   }

//   // ── Main render ───────────────────────────────────────────────────────────────
//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//     >
//       {/* Шапка */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
//           <Text style={styles.backText}>←</Text>
//         </TouchableOpacity>
//         <View style={{ flex: 1 }}>
//           <Text style={styles.headerTitle} numberOfLines={1}>{sessionName}</Text>
//           <Text style={styles.headerSub}>👤 {scannerName} · ✅ {scannedCount}</Text>
//         </View>

//         {/* Кнопки в шапке */}
//         <View style={{ flexDirection: 'row', gap: 6 }}>
//           <TouchableOpacity
//             onPress={() => setShowStatsByLocation(true)}
//             style={styles.headerBtn}
//           >
//             <Text style={styles.headerBtnText}>🏢</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             onPress={() => setShowHistory(true)}
//             style={styles.headerBtn}
//           >
//             <Text style={styles.headerBtnText}>🕐 {history.length}</Text>
//           </TouchableOpacity>
//         </View>
//       </View>

//       {/* Камера */}
//       {!result && !showManual ? (
//         <View style={styles.cameraWrap}>
//           <CameraView
//             style={StyleSheet.absoluteFillObject}
//             facing="back"
//             onBarcodeScanned={submitting ? undefined : handleBarcode}
//             barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'qr'] }}
//           />
//           <View style={styles.overlay}>
//             {submitting ? (
//               <View style={styles.scanningBox}>
//                 <Text style={styles.scanningText}>⏳ Отправляем...</Text>
//               </View>
//             ) : (
//               <>
//                 <View style={styles.scanFrame}>
//                   <View style={[styles.corner, styles.cornerTL]} />
//                   <View style={[styles.corner, styles.cornerTR]} />
//                   <View style={[styles.corner, styles.cornerBL]} />
//                   <View style={[styles.corner, styles.cornerBR]} />
//                 </View>
//                 <Text style={styles.scanHint}>Наведите на штрих-код</Text>
//               </>
//             )}
//           </View>
//           <TouchableOpacity style={styles.manualFloatBtn} onPress={() => setShowManual(true)}>
//             <Text style={styles.manualFloatText}>⌨️ Ввести вручную</Text>
//           </TouchableOpacity>
//         </View>

//       ) : showManual && !result ? (
//         <View style={styles.manualContainer}>
//           <Text style={styles.manualTitle}>⌨️ Ручной ввод</Text>
//           <Text style={styles.manualSubtitle}>Введите инвентарный номер или штрих-код</Text>
//           <TextInput
//             style={styles.manualInput}
//             value={manualInput}
//             onChangeText={setManualInput}
//             placeholder="Например: 1234567890"
//             placeholderTextColor={Colors.text3}
//             autoFocus
//             returnKeyType="search"
//             onSubmitEditing={handleManualSubmit}
//             autoCapitalize="none"
//           />
//           <View style={styles.manualBtnRow}>
//             <TouchableOpacity
//               style={styles.manualCancelBtn}
//               onPress={() => { setShowManual(false); setManualInput('') }}
//             >
//               <Text style={styles.manualCancelText}>Отмена</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[styles.manualSubmitBtn, (!manualInput.trim() || submitting) && styles.btnDisabled]}
//               onPress={handleManualSubmit}
//               disabled={!manualInput.trim() || submitting}
//             >
//               <Text style={styles.manualSubmitText}>{submitting ? '⏳ Поиск...' : 'Найти →'}</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//       ) : (
//         <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.resultContainer}>
//           {/* Статус */}
//           <View style={[styles.statusBox, { backgroundColor: statusBg(result!.status) }]}>
//             <Text style={styles.statusEmoji}>{statusEmoji(result!.status)}</Text>
//             <Text style={[styles.statusLabel, { color: statusColor(result!.status) }]}>
//               {statusLabel(result!.status)}
//             </Text>
//             {result?.status === 'ALREADY' && (
//               <Text style={styles.alreadyHint}>Этот ОС уже был отсканирован ранее</Text>
//             )}
//           </View>

//           {/* Данные ОС */}
//           {result?.asset ? (
//             <View style={styles.assetCard}>
//               <Text style={styles.assetName}>{result.asset.name}</Text>
//               <Text style={styles.assetInv}>{result.asset.inventoryNumber}</Text>
//               {result.asset.barcode && (
//                 <Text style={styles.assetBarcode}>📊 {result.asset.barcode}</Text>
//               )}
//               <View style={styles.divider} />
//               <Row label="📍 Местонахождение" value={result.asset.location} />
//               <Row label="👤 МОЛ" value={result.asset.responsiblePerson} />
//               {result.asset.employee && result.asset.employee !== '—' && (
//                 <Row label="🧑‍💼 Сотрудник" value={result.asset.employee} />
//               )}

//               {result.status === 'MISPLACED' && (
//                 <>
//                   <View style={styles.divider} />
//                   <Text style={styles.misplacedTitle}>⚠️ Не на своём месте</Text>
//                   <Row label="По базе числится" value={result.expectedLocation || '—'} valueColor={Colors.danger} />
//                   <Row label="Найден здесь" value={result.actualLocation || '—'} valueColor={Colors.warn} />
//                 </>
//               )}

//               {result.status === 'ALREADY' && result.previousScan && (
//                 <>
//                   <View style={styles.divider} />
//                   <View style={styles.previousScanBlock}>
//                     <Text style={styles.previousScanTitle}>🔄 Данные первого сканирования</Text>
//                     {result.previousScan.scannedAt && (
//                       <Row
//                         label="🕐 Время"
//                         value={new Date(result.previousScan.scannedAt).toLocaleString('ru-RU', {
//                           day: '2-digit', month: '2-digit',
//                           hour: '2-digit', minute: '2-digit', second: '2-digit',
//                         })}
//                       />
//                     )}
//                     {result.previousScan.scannedBy && (
//                       <Row label="🖊️ Кто сканировал" value={result.previousScan.scannedBy} />
//                     )}
//                     {result.previousScan.note && (
//                       <Row label="📝 Примечание" value={result.previousScan.note} valueColor={Colors.warn} />
//                     )}
//                   </View>
//                 </>
//               )}

//               {(result.status === 'FOUND' || result.status === 'MISPLACED' || result.status === 'ALREADY') && (
//                 <>
//                   <View style={styles.divider} />
//                   <View style={styles.actionBtnRow}>
//                     <TouchableOpacity style={styles.relocateBtn} onPress={openRelocateModal}>
//                       <Text style={styles.relocateBtnText}>✏️ Изменить</Text>
//                     </TouchableOpacity>
//                     <TouchableOpacity
//                       style={styles.cancelScanBtn}
//                       onPress={handleCancelScan}
//                       disabled={cancelling}
//                     >
//                       <Text style={styles.cancelScanBtnText}>
//                         {cancelling ? '...' : '✕ Отменить скан'}
//                       </Text>
//                     </TouchableOpacity>
//                   </View>
//                 </>
//               )}
//             </View>
//           ) : (
//             <View style={styles.assetCard}>
//               <Text style={styles.notFoundText}>{result?.message}</Text>
//             </View>
//           )}

//           <View style={styles.nextBtnRow}>
//             <TouchableOpacity
//               style={styles.manualNextBtn}
//               onPress={() => { handleNext(); setShowManual(true) }}
//               activeOpacity={0.8}
//             >
//               <Text style={styles.manualNextText}>⌨️ Ввести</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={styles.nextBtn}
//               onPress={handleNext}
//               activeOpacity={0.8}
//             >
//               <Text style={styles.nextBtnText}>📷 Сканировать</Text>
//             </TouchableOpacity>
//           </View>
//         </ScrollView>
//       )}

//       {/* Модалка изменения места / сотрудника */}
//       <Modal visible={showRelocate} transparent animationType="slide">
//         <KeyboardAvoidingView
//           style={styles.modalOverlay}
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
//         >
//           <TouchableOpacity
//             style={StyleSheet.absoluteFillObject}
//             activeOpacity={1}
//             onPress={() => { setShowRelocate(false); setSelectedLocationId(null); setSelectedEmployeeId(null); setEmployeeNote('') }}
//           />
//           <View style={styles.modal}>
//             <Text style={styles.modalTitle}>✏️ Изменить данные ОС</Text>

//             {result?.asset && keyboardHeight === 0 && (
//               <View style={styles.modalAssetInfo}>
//                 <Text style={styles.modalAssetName} numberOfLines={1}>{result.asset.name}</Text>
//                 <Text style={styles.modalAssetInv}>{result.asset.inventoryNumber}</Text>
//                 {result.asset.barcode && (
//                   <Text style={styles.modalAssetInv}>📊 {result.asset.barcode}</Text>
//                 )}
//                 <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
//                   <Text style={styles.modalAssetMeta}>📍 {result.asset.location}</Text>
//                   {result.asset.employee && result.asset.employee !== '—' && (
//                     <Text style={styles.modalAssetMeta}>🧑‍💼 {result.asset.employee.split(' ')[0]}</Text>
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

//             <ScrollView
//               style={[styles.locationList, {
//                 maxHeight: keyboardHeight > 0
//                   ? screenHeight - keyboardHeight - 240
//                   : 160
//               }]}
//               showsVerticalScrollIndicator={false}
//               keyboardShouldPersistTaps="handled"
//             >
//               {modalTab === 'location'
//                 ? filteredLocations.map(l => (
//                     <TouchableOpacity
//                       key={l.id}
//                       style={[styles.locationItem, selectedLocationId === l.id && styles.locationItemSelected]}
//                       onPress={() => setSelectedLocationId(selectedLocationId === l.id ? null : l.id)}
//                     >
//                       <Text style={[styles.locationItemText, selectedLocationId === l.id && { color: Colors.accent2, fontWeight: '700' }]}>
//                         {selectedLocationId === l.id ? '✓ ' : ''}{l.name}
//                       </Text>
//                     </TouchableOpacity>
//                   ))
//                 : filteredEmployees.map(e => (
//                     <TouchableOpacity
//                       key={e.id}
//                       style={[styles.locationItem, selectedEmployeeId === e.id && styles.locationItemSelectedEmp]}
//                       onPress={() => setSelectedEmployeeId(selectedEmployeeId === e.id ? null : e.id)}
//                     >
//                       <Text style={[styles.locationItemText, selectedEmployeeId === e.id && { color: Colors.accent, fontWeight: '700' }]}>
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
//                   multiline
//                   numberOfLines={2}
//                   scrollEnabled
//                   blurOnSubmit={false}
//                 />
//               </View>
//             )}

//             {(selectedLocationId || selectedEmployeeId || employeeNote.trim()) && (
//               <View style={styles.selectedSummary}>
//                 {selectedLocationId && (
//                   <Text style={styles.selectedText}>
//                     📍 → {locations.find(l => l.id === selectedLocationId)?.name}
//                   </Text>
//                 )}
//                 {selectedEmployeeId && (
//                   <Text style={styles.selectedTextEmp}>
//                     🧑‍💼 → {employees.find(e => e.id === selectedEmployeeId)?.fullName}
//                   </Text>
//                 )}
//                 {employeeNote.trim() && !selectedEmployeeId && (
//                   <Text style={styles.selectedTextNote}>
//                     ✏️ {employeeNote.trim()}
//                   </Text>
//                 )}
//               </View>
//             )}

//             <View style={styles.modalNote}>
//               <Text style={styles.modalNoteText}>
//                 ⚠️ Обновится в нашей базе. Не забудьте обновить в 1С.
//               </Text>
//             </View>

//             <View style={styles.modalBtnRow}>
//               <TouchableOpacity
//                 style={styles.modalCancelBtn}
//                 onPress={() => { setShowRelocate(false); setSelectedLocationId(null); setSelectedEmployeeId(null); setEmployeeNote('') }}
//               >
//                 <Text style={styles.modalCancelText}>Отмена</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={[styles.modalConfirmBtn, ((!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) || relocating) && styles.btnDisabled]}
//                 onPress={handleRelocate}
//                 disabled={(!selectedLocationId && !selectedEmployeeId && !employeeNote.trim()) || relocating}
//               >
//                 <Text style={styles.modalConfirmText}>
//                   {relocating ? 'Сохраняем...' : '✅ Подтвердить'}
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>
//     </KeyboardAvoidingView>
//   )
// }

// function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
//   return (
//     <View style={rowStyles.row}>
//       <Text style={rowStyles.label}>{label}</Text>
//       <Text style={[rowStyles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
//     </View>
//   )
// }

// const rowStyles = StyleSheet.create({
//   row:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
//   label: { fontSize: 12, color: Colors.text3, flex: 1 },
//   value: { fontSize: 13, color: Colors.text1, fontWeight: '500', flex: 2, textAlign: 'right' },
// })

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: Colors.bg },
//   center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
//   permText:  { fontSize: 16, color: Colors.text1, marginBottom: 20, textAlign: 'center' },
//   header: {
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     paddingHorizontal: 16, paddingVertical: 12,
//     backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border,
//   },
//   backBtn:     { padding: 4 },
//   backText:    { fontSize: 24, color: Colors.accent },
//   headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
//   headerSub:   { fontSize: 11, color: Colors.text3, marginTop: 2 },

//   // ← новый стиль для кнопок в шапке
//   headerBtn:     { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
//   headerBtnText: { fontSize: 13, color: Colors.text2 },

//   clearBtn:     { padding: 8 },
//   clearBtnText: { fontSize: 12, color: Colors.danger },
//   cameraWrap:   { flex: 1 },
//   overlay:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
//   scanFrame:    { width: 240, height: 240, position: 'relative' },
//   corner:       { position: 'absolute', width: 28, height: 28, borderColor: Colors.accent2, borderWidth: 3 },
//   cornerTL:     { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
//   cornerTR:     { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
//   cornerBL:     { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
//   cornerBR:     { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
//   scanHint:     { marginTop: 24, color: '#ffffffcc', fontSize: 14, fontWeight: '500' },
//   scanningBox:  { backgroundColor: '#000000aa', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20 },
//   scanningText: { color: '#fff', fontSize: 16, fontWeight: '600' },
//   manualFloatBtn: {
//     position: 'absolute', bottom: 32, alignSelf: 'center',
//     backgroundColor: '#00000099', borderRadius: 24,
//     paddingHorizontal: 24, paddingVertical: 12,
//     borderWidth: 1, borderColor: '#ffffff33',
//   },
//   manualFloatText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
//   manualContainer:  { flex: 1, padding: 24, justifyContent: 'center' },
//   manualTitle:      { fontSize: 22, fontWeight: '700', color: Colors.text1, marginBottom: 8 },
//   manualSubtitle:   { fontSize: 13, color: Colors.text3, marginBottom: 24 },
//   manualInput: {
//     backgroundColor: Colors.bg2, borderRadius: 12,
//     borderWidth: 1, borderColor: Colors.border,
//     color: Colors.text1, fontSize: 18,
//     padding: 16, marginBottom: 16, fontFamily: 'monospace',
//   },
//   manualBtnRow:    { flexDirection: 'row', gap: 10 },
//   manualCancelBtn: {
//     flex: 1, backgroundColor: Colors.bg3, borderRadius: 12,
//     padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
//   },
//   manualCancelText: { color: Colors.text2, fontWeight: '600', fontSize: 15 },
//   manualSubmitBtn:  {
//     flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12,
//     padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#166534',
//   },
//   manualSubmitText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
//   btnDisabled:      { opacity: 0.4 },
//   resultContainer:  { padding: 20, gap: 16 },
//   statusBox:        { alignItems: 'center', borderRadius: 16, padding: 24 },
//   statusEmoji:      { fontSize: 48, marginBottom: 8 },
//   statusLabel:      { fontSize: 20, fontWeight: '700' },
//   alreadyHint:      { fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
//   previousScanBlock: {
//     backgroundColor: '#1e3a5f22', borderRadius: 8,
//     padding: 12, borderWidth: 1, borderColor: '#60a5fa44',
//   },
//   previousScanTitle: { fontSize: 12, fontWeight: '600', color: '#60a5fa', marginBottom: 10 },
//   assetCard:   {
//     backgroundColor: Colors.bg2, borderRadius: 14,
//     borderWidth: 1, borderColor: Colors.border, padding: 18,
//   },
//   assetName:    { fontSize: 15, fontWeight: '700', color: Colors.text1, marginBottom: 4 },
//   assetInv:     { fontSize: 12, color: Colors.text3, fontFamily: 'monospace', marginBottom: 4 },
//   assetBarcode: { fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginBottom: 14 },
//   divider:      { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
//   misplacedTitle: { fontSize: 13, fontWeight: '600', color: Colors.warn, marginBottom: 8 },
//   notFoundText: { fontSize: 14, color: Colors.danger, textAlign: 'center', padding: 8 },
//   actionBtnRow: { flexDirection: 'row', gap: 8 },
//   relocateBtn:  {
//     flex: 1, backgroundColor: '#0c2a4a', borderRadius: 10,
//     padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e4a7a',
//   },
//   relocateBtnText: { color: Colors.accent, fontWeight: '600', fontSize: 13 },
//   cancelScanBtn:   {
//     flex: 1, backgroundColor: '#2a0a0a', borderRadius: 10,
//     padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4a1a1a',
//   },
//   cancelScanBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 13 },
//   nextBtnRow:    { flexDirection: 'row', gap: 10 },
//   manualNextBtn: {
//     flex: 1, backgroundColor: Colors.bg3, borderRadius: 14,
//     padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
//   },
//   manualNextText: { color: Colors.text2, fontWeight: '600', fontSize: 14 },
//   nextBtn:        {
//     flex: 2, backgroundColor: '#0c4a2a', borderRadius: 14,
//     padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#166534',
//   },
//   nextBtnText:  { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
//   historyCard:  {
//     backgroundColor: Colors.bg2, borderRadius: 10,
//     borderWidth: 1, borderColor: Colors.border, padding: 12,
//   },
//   historyRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
//   historyEmoji:  { fontSize: 20 },
//   historyName:   { fontSize: 13, color: Colors.text1, fontWeight: '500' },
//   historyBarcode:{ fontSize: 11, color: Colors.text3, fontFamily: 'monospace', marginTop: 2 },
//   historyTime:   { fontSize: 11, color: Colors.text3 },
//   empty:         { alignItems: 'center', paddingTop: 60 },
//   emptyText:     { fontSize: 14, color: Colors.text3 },
//   btn:           { backgroundColor: Colors.bg3, borderRadius: 12, padding: 16, minWidth: 160, alignItems: 'center' },
//   btnText:       { color: Colors.text1, fontWeight: '600', fontSize: 15 },
//   modalOverlay:  { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
//   modal: {
//     backgroundColor: Colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
//     padding: 20, maxHeight: '85%',
//   },
//   modalTitle:     { fontSize: 16, fontWeight: '700', color: Colors.text1, marginBottom: 12 },
//   modalAssetInfo: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginBottom: 12 },
//   modalAssetName: { fontSize: 14, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
//   modalAssetInv:  { fontSize: 11, color: Colors.text3, fontFamily: 'monospace' },
//   modalAssetMeta: { fontSize: 11, color: Colors.text3 },
//   modalTabs:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
//   modalTab: {
//     flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
//     backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
//   },
//   modalTabActive:  { borderColor: Colors.accent, backgroundColor: '#0c2a4a' },
//   modalTabText:    { fontSize: 13, color: Colors.text2, fontWeight: '600' },
//   searchInput: {
//     backgroundColor: Colors.bg3, borderRadius: 8,
//     borderWidth: 1, borderColor: Colors.border,
//     color: Colors.text1, fontSize: 14, padding: 10, marginBottom: 8,
//   },
//   locationList:            { marginBottom: 8 },
//   locationItem: {
//     padding: 12, borderRadius: 8, marginBottom: 6,
//     backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
//   },
//   locationItemSelected:    { backgroundColor: '#0c2a1a', borderColor: Colors.accent2 },
//   locationItemSelectedEmp: { backgroundColor: '#0c1a2a', borderColor: Colors.accent },
//   locationItemText:        { fontSize: 13, color: Colors.text1 },
//   noteInputWrap:           { marginBottom: 8 },
//   noteInputLabel:          { fontSize: 11, color: Colors.text3, marginBottom: 6, fontWeight: '500' },
//   noteInput: {
//     backgroundColor: Colors.bg3, borderRadius: 8,
//     borderWidth: 1, borderColor: Colors.border,
//     color: Colors.text1, fontSize: 13,
//     padding: 10, minHeight: 52, textAlignVertical: 'top',
//   },
//   selectedSummary:  { backgroundColor: '#0c2a1a', borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
//   selectedText:     { fontSize: 12, color: Colors.accent2, fontWeight: '600' },
//   selectedTextEmp:  { fontSize: 12, color: Colors.accent,  fontWeight: '600' },
//   selectedTextNote: { fontSize: 12, color: Colors.warn,    fontWeight: '600' },
//   modalNote:        { backgroundColor: '#451a0322', borderRadius: 8, padding: 8, marginBottom: 12 },
//   modalNoteText:    { fontSize: 11, color: Colors.warn },
//   modalBtnRow:      { flexDirection: 'row', gap: 10 },
//   modalCancelBtn: {
//     flex: 1, backgroundColor: Colors.bg3, borderRadius: 12,
//     padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
//   },
//   modalCancelText:  { color: Colors.text2, fontWeight: '600' },
//   modalConfirmBtn: {
//     flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12,
//     padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#166534',
//   },
//   modalConfirmText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
// })



// app/ScanScreen.tsx  (или screens/ScanScreen.tsx — зависит от вашей структуры)

// app/ScanScreen.tsx