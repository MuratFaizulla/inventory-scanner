// app/collection/[id].tsx — Экран сканирования для сбора ОС

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCameraPermissions } from 'expo-camera'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, Vibration,
} from 'react-native'
import api from '../../constants/api'
import { Colors } from '../../constants/colors'
import CameraScanner from '../components/scan/CameraScanner'

// ─── Types ───────────────────────────────────────────────────────────────────

type ScanStatus = 'RETURNED' | 'DAMAGED' | 'LOST'

interface ScanResult {
  item: {
    id: number
    status: string
    returnedAt: string | null
    returnedBy: string | null
  }
  asset: {
    name: string
    inventoryNumber: string
    barcode: string | null
    location: { name: string } | null
    employee: { fullName: string } | null
  }
  alreadyScanned: boolean
  previousStatus?: string
}

interface SessionStats {
  total: number
  returned: number
  damaged: number
  lost: number
  pending: number
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CollectionScanScreen() {
  const { id, sessionName, acceptor } = useLocalSearchParams<{
    id: string; sessionName: string; acceptor: string
  }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()

  const [acceptorName, setAcceptorName] = useState(acceptor || '')
  const [barcode, setBarcode]           = useState('')
  const [scanning, setScanning]         = useState(false)
  const [cameraOn, setCameraOn]         = useState(false)
  const [result, setResult]             = useState<ScanResult | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [errorType, setErrorType]       = useState<'default' | 'not-in-session'>('default')
  const [stats, setStats]               = useState<SessionStats | null>(null)
  const [scannedCount, setScannedCount] = useState(0)

  const cooldown    = useRef(false)
  const barcodeRef  = useRef<TextInput>(null)

  // Сохраняем имя принимающего
  const saveAcceptor = (name: string) => {
    setAcceptorName(name)
    AsyncStorage.setItem('collection-acceptor', name)
  }

  useFocusEffect(useCallback(() => {
    // Загрузить статистику сессии
    api.get(`/collection/${id}`).then(r => {
      setStats(r.data.stats)
    }).catch(() => {})

    // Восстановить имя принимающего
    AsyncStorage.getItem('collection-acceptor').then(saved => {
      if (saved && !acceptorName) setAcceptorName(saved)
    })
  }, [id]))

  const scan = async (status: ScanStatus) => {
    const b = barcode.trim()
    if (!b || scanning) return
    setScanning(true)
    setError(null)
    setResult(null)
    setErrorType('default')
    try {
      const res = await api.post(`/collection/${id}/scan`, {
        barcode: b,
        status,
        returnedBy: acceptorName.trim() || undefined,
      })
      const data = res.data as ScanResult
      setResult(data)
      setBarcode('')
      if (!data.alreadyScanned) {
        setScannedCount(c => c + 1)
        Vibration.vibrate(60)
        // Обновить статистику
        api.get(`/collection/${id}`).then(r => setStats(r.data.stats)).catch(() => {})
      } else {
        Vibration.vibrate([0, 80, 80, 80])
      }
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: string; notInSession?: boolean } } })?.response?.data
      setError(data?.error ?? 'ОС не найдена')
      setErrorType(data?.notInSession ? 'not-in-session' : 'default')
      Vibration.vibrate([0, 80, 80, 80])
    } finally {
      setScanning(false)
      setCameraOn(false)
      setTimeout(() => barcodeRef.current?.focus(), 100)
    }
  }

  const handleBarcodeScan = (code: string) => {
    if (cooldown.current || scanning) return
    cooldown.current = true
    setBarcode(code)
    // По умолчанию RETURNED при сканировании камерой
    scan('RETURNED')
    setTimeout(() => { cooldown.current = false }, 3000)
  }

  const pct = stats && stats.total > 0
    ? Math.round(((stats.returned + stats.damaged + stats.lost) / stats.total) * 100)
    : 0

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Шапка ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>📥 {sessionName}</Text>
          {scannedCount > 0 && (
            <Text style={styles.headerSub}>Принято за сессию: {scannedCount}</Text>
          )}
        </View>
      </View>

      {/* ── Прогресс ─────────────────────────────────────────────── */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#4ade80' }]}>{stats.returned}</Text>
            <Text style={styles.statLbl}>Сдали</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#fb923c' }]}>{stats.damaged}</Text>
            <Text style={styles.statLbl}>Повреждено</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#c084fc' }]}>{stats.lost}</Text>
            <Text style={styles.statLbl}>Утеряно</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.danger }]}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Не сдали</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: pct === 100 ? '#4ade80' : Colors.text2 }]}>{pct}%</Text>
            <Text style={styles.statLbl}>Прогресс</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">

        {/* ── Камера ────────────────────────────────────────────────── */}
        {cameraOn && (
          <View style={{ height: 240, borderRadius: 14, overflow: 'hidden', marginBottom: 4 }}>
            {permission?.granted ? (
              <CameraScanner
                submitting={scanning}
                onBarcodeScanned={handleBarcodeScan}
                onManual={() => setCameraOn(false)}
              />
            ) : (
              <View style={styles.permBox}>
                <Text style={styles.permText}>Нет доступа к камере</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>Разрешить камеру</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Кнопка камеры ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.cameraBtn, cameraOn && styles.cameraBtnActive]}
          onPress={() => { setResult(null); setError(null); setCameraOn(v => !v) }}
          activeOpacity={0.8}
        >
          <Text style={styles.cameraBtnText}>
            {cameraOn ? '✕ Закрыть камеру' : '📷 Сканировать камерой'}
          </Text>
        </TouchableOpacity>

        {/* ── Принимает ────────────────────────────────────────────── */}
        <TextInput
          style={styles.input}
          value={acceptorName}
          onChangeText={saveAcceptor}
          placeholder="👤 Кто принимает (ФИО)..."
          placeholderTextColor={Colors.text3}
          returnKeyType="next"
        />

        {/* ── Ввод штрих-кода ────────────────────────────────────── */}
        <TextInput
          ref={barcodeRef}
          style={[styles.input, { fontFamily: 'monospace', fontSize: 16 }]}
          value={barcode}
          onChangeText={t => { setBarcode(t); setError(null); setResult(null) }}
          placeholder="⌨️ Штрих-код или инв. номер..."
          placeholderTextColor={Colors.text3}
          onSubmitEditing={() => scan('RETURNED')}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!scanning}
        />

        {/* ── Кнопки статуса ────────────────────────────────────── */}
        <View style={styles.scanBtns}>
          <ScanButton
            label="✅ Принято"
            bg="#1a3a2a" border="#2d6a45" color="#4ade80"
            disabled={!barcode.trim() || scanning}
            loading={scanning}
            onPress={() => scan('RETURNED')}
          />
          <ScanButton
            label="⚠️ Повреждено"
            bg="#431407" border="#ea580c" color="#fb923c"
            disabled={!barcode.trim() || scanning}
            loading={scanning}
            onPress={() => scan('DAMAGED')}
          />
          <ScanButton
            label="🔴 Утерян"
            bg="#3b0764" border="#9333ea" color="#c084fc"
            disabled={!barcode.trim() || scanning}
            loading={scanning}
            onPress={() => scan('LOST')}
          />
        </View>

        <Text style={styles.hint}>Enter = Принято · Принимает штрих-код или инвентарный номер</Text>

        {/* ── Результат ────────────────────────────────────────────── */}
        {result && <ScanResultBlock result={result} />}

        {/* ── Ошибка ───────────────────────────────────────────────── */}
        {error && (
          <View style={[
            styles.errorBox,
            errorType === 'not-in-session'
              ? { backgroundColor: '#1c1a04', borderColor: '#ca8a04' }
              : { backgroundColor: '#450a0a', borderColor: '#dc2626' },
          ]}>
            <Text style={[
              styles.errorText,
              { color: errorType === 'not-in-session' ? '#fbbf24' : Colors.danger }
            ]}>
              {errorType === 'not-in-session' ? '⚠️' : '❌'} {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Компонент кнопки статуса ────────────────────────────────────────────────

function ScanButton({
  label, bg, border, color, disabled, loading, onPress
}: {
  label: string; bg: string; border: string; color: string
  disabled: boolean; loading: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[
        styles.statusBtn,
        { backgroundColor: disabled ? Colors.bg3 : bg, borderColor: disabled ? Colors.border : border },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.statusBtnText, { color: disabled ? Colors.text3 : color }]}>
        {loading ? '⏳' : label}
      </Text>
    </TouchableOpacity>
  )
}

// ─── Блок результата скана ───────────────────────────────────────────────────

function ScanResultBlock({ result }: { result: ScanResult }) {
  const { item, asset, alreadyScanned, previousStatus } = result

  const statusColors = {
    RETURNED: { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: '✅ Принято' },
    DAMAGED:  { bg: '#431407', border: '#ea580c', text: '#fb923c', label: '⚠️ Повреждено' },
    LOST:     { bg: '#3b0764', border: '#9333ea', text: '#c084fc', label: '🔴 Утерян' },
  }
  const c = alreadyScanned
    ? { bg: '#1c1a04', border: '#ca8a04', text: '#fbbf24', label: `⚠️ Уже отмечен: ${previousStatus}` }
    : (statusColors[item.status as keyof typeof statusColors] ?? statusColors.RETURNED)

  return (
    <View style={[styles.resultBox, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.resultLabel, { color: c.text }]}>{c.label}</Text>
      <Text style={styles.resultName}>{asset.name}</Text>
      <Text style={styles.resultInvNum}>{asset.inventoryNumber}</Text>
      <View style={styles.resultMeta}>
        {asset.location && (
          <Text style={styles.resultMetaText}>📍 {asset.location.name}</Text>
        )}
        {asset.employee && (
          <Text style={styles.resultMetaText}>🧑‍💼 {asset.employee.fullName}</Text>
        )}
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { paddingVertical: 4, paddingRight: 8 },
  backText:    { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  headerSub:   { fontSize: 11, color: Colors.accent2, marginTop: 2 },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 18, fontWeight: '800' },
  statLbl:  { fontSize: 9, color: Colors.text3, marginTop: 2, textAlign: 'center' },

  cameraBtn: {
    backgroundColor: '#0c4a2a', borderRadius: 14,
    padding: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  cameraBtnActive: {
    backgroundColor: Colors.bg3, borderColor: Colors.border,
  },
  cameraBtnText: { fontSize: 15, color: Colors.accent2, fontWeight: '700' },

  input: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 15, padding: 14,
  },

  scanBtns:  { gap: 8 },
  statusBtn: {
    borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1,
  },
  statusBtnText: { fontSize: 15, fontWeight: '700' },

  hint: { fontSize: 11, color: Colors.text3, textAlign: 'center' },

  permBox: {
    flex: 1, backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  permText:    { color: Colors.text2, fontSize: 14 },
  permBtn:     { backgroundColor: Colors.accent, borderRadius: 8, padding: 10 },
  permBtnText: { color: '#000', fontWeight: '700' },

  errorBox:  { borderRadius: 12, borderWidth: 1, padding: 14 },
  errorText: { fontSize: 14, fontWeight: '600' },

  resultBox:   { borderRadius: 14, borderWidth: 1, padding: 16 },
  resultLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  resultName:  { fontSize: 15, fontWeight: '700', color: Colors.text1, marginBottom: 2 },
  resultInvNum: { fontFamily: 'monospace', fontSize: 12, color: Colors.text3, marginBottom: 8 },
  resultMeta:  { gap: 4 },
  resultMetaText: { fontSize: 12, color: Colors.text2 },
})
