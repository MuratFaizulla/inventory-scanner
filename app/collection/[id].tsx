// app/collection/[id].tsx — Сканирование Сбора ОС

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import api from '../../constants/api'
import { goBack } from '../../constants/nav'
import { Colors } from '../../constants/colors'
import CameraScanner from '../../components/scan/CameraScanner'
import CollectionHistoryScreen from '../../components/collection/CollectionHistoryScreen'
import ResultScreen from '../../components/collection/ResultScreen'
import type {
  HistoryEntry, PendingContext, ScanResult,
  ScanStatus, ScreenMode, SessionStats,
} from '../../components/collection/types'

let _seq = 0
const uid     = () => `${Date.now()}-${++_seq}`
const nowTime = () =>
  new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function CollectionScanScreen() {
  const { id, sessionName } = useLocalSearchParams<{ id: string; sessionName: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  const [mode,         setMode]         = useState<ScreenMode>('camera')
  const [acceptorName, setAcceptorName] = useState('')
  const [manualInput,  setManualInput]  = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [result,       setResult]       = useState<ScanResult | null>(null)
  const [context,      setContext]      = useState<PendingContext | null>(null)
  const [stats,        setStats]        = useState<SessionStats | null>(null)
  const [scannedCount, setScannedCount] = useState(0)
  const [error,        setError]        = useState<string | null>(null)
  const [errorNotIn,   setErrorNotIn]   = useState(false)

  const historyRef = useRef<HistoryEntry[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const cooldown    = useRef(false)
  const lastBarcode = useRef<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem('scannerName').then(n => { if (n) setAcceptorName(n) })
  }, [])

  useFocusEffect(useCallback(() => {
    api.get(`/collection/${id}`).then(r => setStats(r.data.stats)).catch(() => {})
  }, [id]))

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    const item = { ...entry, id: uid() }
    historyRef.current = [item, ...historyRef.current].slice(0, 50)
    setHistory([...historyRef.current])
  }, [])

  const loadContext = useCallback(async (asset: ScanResult['asset']) => {
    try {
      const res   = await api.get(`/collection/${id}`)
      const items = res.data.items as {
        status: string
        asset: { name: string; inventoryNumber: string; employee: { fullName: string } | null; location: { name: string } | null }
      }[]
      setStats(res.data.stats)

      const empName = asset.employee?.fullName ?? null
      const locName = asset.location?.name    ?? null

      setContext({
        employeeName:    empName,
        employeePending: empName
          ? items.filter(i => i.status === 'PENDING' && i.asset.employee?.fullName === empName)
              .map(i => ({ name: i.asset.name, inventoryNumber: i.asset.inventoryNumber }))
          : [],
        locationName:         locName,
        locationPendingCount: locName
          ? items.filter(i => i.status === 'PENDING' && i.asset.location?.name === locName).length
          : 0,
      })
    } catch { /* некритично */ }
  }, [id])

  const doScan = useCallback(async (barcode: string, status: ScanStatus = 'RETURNED') => {
    if (!barcode.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    setErrorNotIn(false)
    setContext(null)
    try {
      const res  = await api.post(`/collection/${id}/scan`, {
        barcode: barcode.trim(), status,
        returnedBy: acceptorName || undefined,
      })
      const data = res.data as ScanResult
      setResult(data)
      setMode('result')

      if (data.alreadyScanned) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        addHistory({ name: data.asset.name, inv: data.asset.inventoryNumber, status: 'ALREADY', time: nowTime() })
      } else {
        setScannedCount(c => c + 1)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        addHistory({ name: data.asset.name, inv: data.asset.inventoryNumber, status, time: nowTime() })
      }
      loadContext(data.asset)
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: string; notInSession?: boolean } } })?.response?.data
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(data?.error ?? 'ОС не найдена')
      setErrorNotIn(!!data?.notInSession)
      setMode('result')
    } finally {
      setSubmitting(false)
    }
  }, [id, acceptorName, submitting, addHistory, loadContext])

  const changeStatus = async (newStatus: ScanStatus) => {
    if (!result?.item.id || submitting) return
    setSubmitting(true)
    try {
      await api.patch(`/collection/${id}/item/${result.item.id}`, { status: newStatus })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setResult(prev => prev ? { ...prev, item: { ...prev.item, status: newStatus }, alreadyScanned: false } : prev)
      addHistory({ name: result.asset.name, inv: result.asset.inventoryNumber, status: newStatus, time: nowTime() })
      loadContext(result.asset)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBarcode = useCallback((code: string) => {
    if (cooldown.current || mode !== 'camera') return
    if (lastBarcode.current === code) return
    cooldown.current    = true
    lastBarcode.current = code
    doScan(code)
  }, [mode, doScan])

  const handleManualSubmit = () => {
    if (!manualInput.trim() || submitting) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    doScan(manualInput.trim())
    setManualInput('')
  }

  const handleNext = () => {
    setResult(null); setContext(null); setError(null)
    setMode('camera')
    setTimeout(() => { cooldown.current = false; lastBarcode.current = null }, 500)
  }

  const handleNextManual = () => {
    handleNext()
    setTimeout(() => setMode('manual'), 100)
  }

  // ── Нет разрешения ──
  if (!permission) return <View style={styles.container} />
  if (!permission.granted) return (
    <View style={styles.center}>
      <Text style={styles.permText}>📷 Нужен доступ к камере</Text>
      <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
        <Text style={styles.permBtnText}>Разрешить</Text>
      </TouchableOpacity>
    </View>
  )

  // ── История ──
  if (mode === 'history') return (
    <CollectionHistoryScreen
      history={history}
      stats={stats}
      scannedCount={scannedCount}
      onBack={() => setMode('camera')}
      onClear={() => { historyRef.current = []; setHistory([]) }}
    />
  )

  // ── Шапка (общая) ──
  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>📥 {sessionName}</Text>
        <Text style={styles.headerSub}>👤 {acceptorName || '—'}  ·  ✅ {scannedCount}</Text>
      </View>
      {stats && (
        <View style={styles.headerStats}>
          <Text style={[styles.headerStat, { color: Colors.accent2 }]}>{stats.returned}</Text>
          <Text style={styles.headerStatDiv}>/</Text>
          <Text style={[styles.headerStat, { color: Colors.danger }]}>{stats.pending}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.histBtn} onPress={() => setMode('history')}>
        <Text style={styles.histBtnText}>🕐 {history.length}</Text>
      </TouchableOpacity>
    </View>
  )

  // ── Ручной ввод ──
  if (mode === 'manual') return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {header}
      <View style={styles.manualWrap}>
        <Text style={styles.manualTitle}>⌨️ Ручной ввод</Text>
        <Text style={styles.manualSub}>Инвентарный номер или штрих-код</Text>
        <TextInput
          style={styles.manualInput}
          value={manualInput}
          onChangeText={setManualInput}
          placeholder="Например: 370063383"
          placeholderTextColor={Colors.text3}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={handleManualSubmit}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.manualBtns}>
          <TouchableOpacity style={styles.manualCancelBtn} onPress={() => { setMode('camera'); setManualInput('') }}>
            <Text style={styles.manualCancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.manualSubmitBtn, (!manualInput.trim() || submitting) && { opacity: 0.4 }]}
            onPress={handleManualSubmit}
            disabled={!manualInput.trim() || submitting}
          >
            <Text style={styles.manualSubmitText}>{submitting ? '⏳ Поиск...' : '✅ Принять'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )

  // ── Результат ──
  if (mode === 'result') return (
    <View style={styles.container}>
      {header}
      <ResultScreen
        result={result}
        context={context}
        error={error}
        errorNotIn={errorNotIn}
        submitting={submitting}
        onNext={handleNext}
        onNextManual={handleNextManual}
        onChangeStatus={changeStatus}
      />
    </View>
  )

  // ── Камера (основной режим) ──
  return (
    <View style={styles.container}>
      {header}
      <CameraScanner
        submitting={submitting}
        onBarcodeScanned={handleBarcode}
        onManual={() => setMode('manual')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center:    { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText:  { fontSize: 16, color: Colors.text1, marginBottom: 20, textAlign: 'center' },
  permBtn:   { backgroundColor: Colors.bg2, borderRadius: 12, padding: 14, alignItems: 'center', minWidth: 160 },
  permBtnText: { color: Colors.text1, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:      { padding: 4 },
  backText:     { fontSize: 24, color: Colors.accent },
  headerTitle:  { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  headerSub:    { fontSize: 11, color: Colors.text3, marginTop: 2 },
  headerStats:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerStat:   { fontSize: 15, fontWeight: '800' },
  headerStatDiv: { fontSize: 12, color: Colors.text3, marginHorizontal: 1 },
  histBtn: {
    backgroundColor: Colors.bg3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  histBtnText: { fontSize: 13, color: Colors.text2 },

  manualWrap:  { flex: 1, padding: 24, justifyContent: 'center' },
  manualTitle: { fontSize: 22, fontWeight: '700', color: Colors.text1, marginBottom: 8 },
  manualSub:   { fontSize: 13, color: Colors.text3, marginBottom: 24 },
  manualInput: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 18,
    padding: 16, marginBottom: 16, fontFamily: 'monospace',
  },
  manualBtns:      { flexDirection: 'row', gap: 10 },
  manualCancelBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  manualCancelText: { color: Colors.text2, fontWeight: '600', fontSize: 15 },
  manualSubmitBtn: {
    flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  manualSubmitText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
})
