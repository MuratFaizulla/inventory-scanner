// app/ScanScreen.tsx

import { useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { confirmDialog, notify } from '../constants/dialog'
import { errorText } from '../constants/errorText'
import { goBack } from '../constants/nav'
import { useAccountUser } from '../constants/account'
import { useAct, type ActItem } from '../constants/act'

import RelocateModal from '../components/RelocateModal'
import SyncBanner from '../components/SyncBanner'
import CameraScanner from '../components/scan/CameraScanner'
import HistoryScreen from '../components/scan/HistoryScreen'
import ManualInput from '../components/scan/ManualInput'
import ScanHeader from '../components/scan/ScanHeader'
import ScanResultCard from '../components/scan/ScanResultCard'
import StatsByLocationScreen from '../components/scan/StatsByLocationScreen'

import type { HistoryItem, ScanResult, ScanStatus } from '../components/scan/types'

let _seq = 0
const uid = () => `${Date.now()}-${++_seq}`

export default function ScanScreen() {
  const { sessionId, sessionName } = useLocalSearchParams<{ sessionId: string; sessionName: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const router       = useRouter()
  // Открытый акт модуль сразу сохраняет на телефон — дальше по кабинетам
  // сканировать можно и без Wi-Fi
  const { act } = useAct(Number(sessionId))

  // ── Сканер ────────────────────────────────────────────────────────────────────
  const [result,       setResult]       = useState<ScanResult | null>(null)
  const scannerName = useAccountUser()?.name ?? ''
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

  // ── Перемещение: позиция, открытая в модалке ─────────────────────────────────
  const [relocateItem, setRelocateItem] = useState<ActItem | null>(null)

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState(false)

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
      setResult({ status: 'NOT_FOUND', message: errorText(e) })
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
    setRelocateItem(null)
    setTimeout(() => {
      cooldown.current    = false
      lastBarcode.current = null
    }, 600)
  }

  // ── Перемещение ───────────────────────────────────────────────────────────────
  const openRelocate = () => setRelocateItem(result?.item ?? null)

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
      notify('Не удалось отменить скан', errorText(e))
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
        act={act}
        item={relocateItem}
        onClose={() => setRelocateItem(null)}
        onSaved={handleNext}
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
