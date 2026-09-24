// app/ScanScreen.tsx

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, View,
} from 'react-native'
import { confirmDialog, notify } from '../constants/dialog'
import { goBack } from '../constants/nav'
import { useAct } from '../constants/act'
import { getEmployeeOptions, getLocationOptions } from '../constants/sessionsApi'

import SyncBanner from '../components/SyncBanner'
import CameraScanner from '../components/scan/CameraScanner'
import HistoryScreen from '../components/scan/HistoryScreen'
import ManualInput from '../components/scan/ManualInput'
import RelocateModal from '../components/scan/RelocateModal'
import ScanHeader from '../components/scan/ScanHeader'
import ScanResultCard from '../components/scan/ScanResultCard'
import StatsByLocationScreen from '../components/scan/StatsByLocationScreen'

import type { LastRelocate } from '../components/scan/RelocateModal'
import type { Employee, HistoryItem, Location, ScanResult, ScanStatus } from '../components/scan/types'

let _seq = 0
const uid = () => `${Date.now()}-${++_seq}`

export default function ScanScreen() {
  const { sessionId, sessionName } = useLocalSearchParams<{ sessionId: string; sessionName: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const router       = useRouter()
  const { height: screenHeight } = useWindowDimensions()
  // Открытый акт модуль сразу сохраняет на телефон — дальше по кабинетам
  // сканировать можно и без Wi-Fi
  const { act } = useAct(Number(sessionId))

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
    getLocationOptions().then(setLocations).catch(() => {})
    getEmployeeOptions().then(setEmployees).catch(() => {})
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
    const code = barcode.trim()
    try {
      const r = await act.scan(code)

      if (r.kind === 'not_found') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setResult({ status: 'NOT_FOUND', message: `Не найден: ${code}` })
        addToHistory(code, 'NOT_FOUND', code)
        return
      }

      if (r.kind === 'unknown') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setResult({
          status:  'OFFLINE_UNKNOWN',
          queued:  true,
          message: `Кода ${code} нет в сохранённой копии акта. Когда появится связь, сервер решит: излишек это или такого ОС нет в базе.`,
        })
        setScannedCount(c => c + 1)
        addToHistory(code, 'OFFLINE_UNKNOWN', code)
        return
      }

      const name = r.item.name ?? code
      if (r.kind === 'already') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setResult({ status: 'ALREADY', item: r.item })
        addToHistory(code, 'ALREADY', name)
        return
      }

      const status: ScanStatus =
        r.kind === 'misplaced' ? 'MISPLACED' :
        r.kind === 'surplus'   ? 'SURPLUS'   : 'FOUND'

      if (status === 'FOUND') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      else                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)

      setResult({ status, item: r.item, queued: r.queued })
      setScannedCount(c => c + 1)
      addToHistory(code, status, name)
    } catch (e) {
      // Модуль акта отдаёт текст для человека: отказ сервера или «нет копии»
      setResult({ status: 'NOT_FOUND', message: (e as Error).message || 'Ошибка сервера' })
    } finally {
      setSubmitting(false)
    }
  }, [act, addToHistory])

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
    if (!result?.item) return
    if (!selectedLocationId && !selectedEmployeeId) {
      notify('Выберите', 'Выберите кабинет или сотрудника')
      return
    }
    setRelocating(true)
    try {
      const loc = locations.find(l => l.id === selectedLocationId)
      const emp = employees.find(e => e.id === selectedEmployeeId)

      const { queued } = await act.relocate(result.item.id, {
        ...(loc && { location: loc.name }),
        ...(emp && { employee: emp.fullName }),
      })

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
        queued && '📴 Сохранено на телефоне — уйдёт, когда появится связь',
      ].filter(Boolean).join('\n')

      setShowRelocate(false)
      resetRelocate()
      notify('✅ Готово', msg)
      handleNext()
    } catch (e) {
      notify('Ошибка', (e as Error).message || 'Не удалось переместить')
    } finally {
      setRelocating(false)
    }
  }

  // ── Cancel scan ───────────────────────────────────────────────────────────────
  const handleCancelScan = async () => {
    if (!result?.item) return
    const ok = await confirmDialog(
      'Отменить сканирование?',
      'ОС вернётся в статус "Не проверен"',
      'Да, отменить',
      { cancelText: 'Нет', destructive: true },
    )
    if (!ok) return
    setCancelling(true)
    try {
      await act.cancel(result.item.id)
      handleNext()
    } catch (e) {
      notify('Ошибка', (e as Error).message || 'Не удалось отменить')
    } finally {
      setCancelling(false)
    }
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
        onBack={() => goBack(router)}
        onHistory={() => setShowHistory(true)}
        onStats={() => setShowStatsByLocation(true)}
      />

      <SyncBanner />

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
        item={result?.item}
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
