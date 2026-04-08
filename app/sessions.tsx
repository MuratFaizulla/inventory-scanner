import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCameraPermissions } from 'expo-camera'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  Alert, FlatList, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Vibration,
} from 'react-native'
import api from '../constants/api'
import { Colors } from '../constants/colors'
import CameraScanner from './components/scan/CameraScanner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface InventorySession {
  id: number
  name: string
  status: string
  startedAt: string
  location: { name?: string } | string | null
}

interface CollectionSession {
  id: number
  name: string
  status: 'OPEN' | 'CLOSED'
  assetType: string | null
  deadline: string | null
  createdBy: string | null
  _count: { items: number }
}

interface LookupResult {
  id: number
  name: string
  inventoryNumber: string
  barcode: string | null
  assetType: string
  location: { name: string } | null
  employee: { fullName: string } | null
  responsiblePerson: { fullName: string } | null
  organization: { name: string } | null
}

type Tab = 'inventory' | 'collection' | 'lookup'

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const [tab, setTab] = useState<Tab>('inventory')
  const [scannerName, setScannerName] = useState('')
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('scannerName').then(n => setScannerName(n || ''))
  }, []))

  const handleLogout = async () => {
    await AsyncStorage.removeItem('scannerName')
    router.replace('/')
  }

  return (
    <View style={styles.container}>
      {/* ── Шапка ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>👋 {scannerName}</Text>
          <Text style={styles.headerSub}>НИШ Инвентаризация</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* ── Табы ──────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {([
          ['inventory',  '📋', 'Инвентаризация'],
          ['collection', '📥', 'Сбор ОС'],
          ['lookup',     '🔍', 'Поиск ОС'],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Контент ───────────────────────────────────────────────── */}
      {tab === 'inventory'  && <InventoryTab scannerName={scannerName} />}
      {tab === 'collection' && <CollectionTab scannerName={scannerName} />}
      {tab === 'lookup'     && <LookupTab />}
    </View>
  )
}

// ─── Инвентаризация ──────────────────────────────────────────────────────────

function InventoryTab({ scannerName }: { scannerName: string }) {
  const [sessions, setSessions] = useState<{
    id: number; name: string; status: string; startedAt: string;
    location: string | null; total: number; found: number;
    notFound: number; misplaced: number; pending: number;
  }[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/inventory')
      const active: InventorySession[] = res.data.filter((s: InventorySession) => s.status === 'IN_PROGRESS')
      const detailed = await Promise.all(
        active.map((s) =>
          api.get(`/inventory/${s.id}`).then(r => {
            const items = r.data.items ?? []
            const locationName =
              typeof s.location === 'object' && s.location !== null
                ? s.location.name ?? null
                : (s.location as string | null) ?? null
            return {
              id: s.id, name: String(s.name || ''), status: s.status,
              startedAt: s.startedAt, location: locationName,
              total:     items.length,
              found:     items.filter((i: { status: string }) => i.status === 'FOUND').length,
              notFound:  items.filter((i: { status: string }) => i.status === 'NOT_FOUND').length,
              misplaced: items.filter((i: { status: string }) => i.status === 'MISPLACED').length,
              pending:   items.filter((i: { status: string }) => i.status === 'PENDING').length,
            }
          })
        )
      )
      setSessions(detailed)
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить акты инвентаризации')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const progress = (s: typeof sessions[0]) => {
    const checked = s.found + s.notFound + s.misplaced
    return s.total > 0 ? Math.round(checked / s.total * 100) : 0
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })

  return (
    <FlatList
      data={sessions}
      keyExtractor={s => String(s.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={!loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Нет активных актов</Text>
          <Text style={styles.emptySub}>Создайте акт на веб-сайте</Text>
        </View>
      ) : null}
      renderItem={({ item: s }) => {
        const prog = progress(s)
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={2}>{s.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>В процессе</Text>
              </View>
            </View>
            {s.location ? <Text style={styles.cardLocation}>📍 {s.location}</Text> : null}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { flex: prog }]} />
              <View style={{ flex: 100 - prog }} />
            </View>
            <Text style={styles.progressText}>{prog}% · {s.total} ОС</Text>
            <View style={styles.statsRow}>
              <Text style={[styles.stat, { color: Colors.accent2 }]}>✅ {s.found}</Text>
              <Text style={[styles.stat, { color: Colors.danger }]}>❌ {s.notFound}</Text>
              <Text style={[styles.stat, { color: Colors.warn }]}>⚠️ {s.misplaced}</Text>
              <Text style={[styles.stat, { color: Colors.text3 }]}>⏳ {s.pending}</Text>
              <Text style={[styles.stat, { color: Colors.text3, marginLeft: 'auto' }]}>
                {fmtDate(s.startedAt)}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: s.id, name: s.name } })}
              >
                <Text style={styles.detailBtnText}>📋 Детали</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => router.push({ pathname: '/scan', params: { sessionId: s.id, sessionName: s.name } })}
              >
                <Text style={styles.scanBtnText}>📷 Сканировать</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }}
    />
  )
}

// ─── Сбор ОС ─────────────────────────────────────────────────────────────────

function CollectionTab({ scannerName }: { scannerName: string }) {
  const [sessions, setSessions] = useState<CollectionSession[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/collection')
      setSessions((res.data as CollectionSession[]).filter(s => s.status === 'OPEN'))
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить сессии сбора ОС')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const fmtDeadline = (d: string | null) => {
    if (!d) return null
    const date = new Date(d)
    const now  = new Date()
    const overdue = date < now
    const label = date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    return { label, overdue }
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={s => String(s.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={!loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📥</Text>
          <Text style={styles.emptyText}>Нет открытых сессий сбора</Text>
          <Text style={styles.emptySub}>Создайте сессию на веб-сайте</Text>
        </View>
      ) : null}
      renderItem={({ item: s }) => {
        const dl = fmtDeadline(s.deadline)
        return (
          <View style={[styles.card, { borderColor: '#2d6a45' }]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={2}>{s.name}</Text>
              <View style={[styles.badge, { backgroundColor: '#052e16' }]}>
                <Text style={[styles.badgeText, { color: '#4ade80' }]}>🟢 Открыта</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              {s.assetType && (
                <Text style={styles.cardMeta}>📦 {s.assetType}</Text>
              )}
              {dl && (
                <Text style={[styles.cardMeta, dl.overdue && { color: Colors.danger }]}>
                  {dl.overdue ? '⚠️' : '📅'} {dl.label}
                </Text>
              )}
              <Text style={styles.cardMeta}>📋 {s._count.items} ОС</Text>
              {s.createdBy && (
                <Text style={styles.cardMeta}>👤 {s.createdBy}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => router.push({
                pathname: '/collection/[id]',
                params: { id: s.id, sessionName: s.name, acceptor: scannerName },
              })}
            >
              <Text style={styles.scanBtnText}>📷 Принимать ОС</Text>
            </TouchableOpacity>
          </View>
        )
      }}
    />
  )
}

// ─── Поиск ОС ────────────────────────────────────────────────────────────────

function LookupTab() {
  const [permission, requestPermission] = useCameraPermissions()
  const [barcode, setBarcode]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<LookupResult | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const cooldown = useRef(false)

  const lookup = async (code: string) => {
    const b = code.trim()
    if (!b || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.get(`/assets/scan/${encodeURIComponent(b)}`)
      setResult(res.data)
      Vibration.vibrate(60)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'ОС не найдена')
      Vibration.vibrate([0, 80, 80, 80])
    } finally {
      setLoading(false)
      setCameraOn(false)
    }
  }

  const handleBarcodeScan = (code: string) => {
    if (cooldown.current) return
    cooldown.current = true
    setBarcode(code)
    lookup(code)
    setTimeout(() => { cooldown.current = false }, 2000)
  }

  const reset = () => {
    setBarcode('')
    setResult(null)
    setError(null)
    setCameraOn(false)
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Камера */}
      {cameraOn && (
        <View style={{ height: 240 }}>
          {permission?.granted ? (
            <CameraScanner
              submitting={loading}
              onBarcodeScanned={handleBarcodeScan}
              onManual={() => { setCameraOn(false); setBarcode('') }}
            />
          ) : (
            <View style={[styles.cameraPlaceholder]}>
              <Text style={styles.permText}>Нет доступа к камере</Text>
              <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Разрешить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={{ padding: 16, gap: 10 }}>
        {/* Кнопка камеры */}
        {!cameraOn && (
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => { reset(); setCameraOn(true) }}
            activeOpacity={0.8}
          >
            <Text style={styles.cameraBtnText}>📷 Сканировать штрих-код</Text>
          </TouchableOpacity>
        )}
        {cameraOn && (
          <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setCameraOn(false)}>
            <Text style={styles.cancelCameraBtnText}>✕ Закрыть камеру</Text>
          </TouchableOpacity>
        )}

        {/* Ручной ввод */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={barcode}
            onChangeText={t => { setBarcode(t); setError(null) }}
            placeholder="Инв. номер или штрих-код..."
            placeholderTextColor={Colors.text3}
            onSubmitEditing={() => lookup(barcode)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!barcode.trim() || loading) && { opacity: 0.5 }]}
            onPress={() => lookup(barcode)}
            disabled={!barcode.trim() || loading}
          >
            <Text style={styles.searchBtnText}>{loading ? '⏳' : '🔍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Ошибка */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}

        {/* Результат */}
        {result && <LookupResultCard result={result} onReset={reset} />}

        {!result && !error && !loading && (
          <View style={styles.lookupHint}>
            <Text style={styles.lookupHintIcon}>🔍</Text>
            <Text style={styles.lookupHintText}>
              Отсканируйте штрих-код или введите инвентарный номер чтобы узнать информацию об ОС
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Карточка результата поиска ──────────────────────────────────────────────

function LookupResultCard({ result, onReset }: { result: LookupResult; onReset: () => void }) {
  return (
    <View style={styles.resultCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Text style={styles.resultName} numberOfLines={3}>{result.name}</Text>
        <TouchableOpacity onPress={onReset} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Инв. номер</Text>
        <Text style={styles.resultValue}>{result.inventoryNumber}</Text>
      </View>
      {result.barcode && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Штрих-код</Text>
          <Text style={[styles.resultValue, { fontFamily: 'monospace' }]}>{result.barcode}</Text>
        </View>
      )}
      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Тип ОС</Text>
        <Text style={styles.resultValue}>{result.assetType || '—'}</Text>
      </View>
      {result.location && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>📍 Кабинет</Text>
          <Text style={[styles.resultValue, { color: Colors.accent }]}>{result.location.name}</Text>
        </View>
      )}
      {result.employee && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>🧑‍💼 Сотрудник</Text>
          <Text style={[styles.resultValue, { color: Colors.accent2 }]}>{result.employee.fullName}</Text>
        </View>
      )}
      {result.responsiblePerson && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>👔 МОЛ</Text>
          <Text style={styles.resultValue}>{result.responsiblePerson.fullName}</Text>
        </View>
      )}
      {result.organization && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>🏢 Организация</Text>
          <Text style={styles.resultValue}>{result.organization.name}</Text>
        </View>
      )}
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  greeting:  { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  headerSub: { fontSize: 12, color: Colors.text3, marginTop: 2 },
  logoutBtn: { padding: 8 },
  logoutText: { fontSize: 13, color: Colors.text3 },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.accent },
  tabIcon:  { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 10, color: Colors.text3, fontWeight: '600' },
  tabLabelActive: { color: Colors.accent },

  // Cards
  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6, gap: 8,
  },
  cardName:     { fontSize: 14, fontWeight: '600', color: Colors.text1, flex: 1 },
  cardLocation: { fontSize: 12, color: Colors.text3, marginBottom: 10 },
  cardMeta:     { fontSize: 12, color: Colors.text3 },
  badge: { backgroundColor: '#1e3a5f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#60a5fa', fontWeight: '600' },

  progressBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2,
    overflow: 'hidden', marginBottom: 4, flexDirection: 'row',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.text3, marginBottom: 8 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat:         { fontSize: 12 },

  btnRow:     { flexDirection: 'row', gap: 8 },
  detailBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  detailBtnText: { fontSize: 13, color: Colors.text2, fontWeight: '600' },
  scanBtn: {
    flex: 1, backgroundColor: '#0c4a2a', borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  scanBtnText: { fontSize: 13, color: Colors.accent2, fontWeight: '700' },

  // Empty state
  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.text2, fontWeight: '600' },
  emptySub:  { fontSize: 13, color: Colors.text3, marginTop: 6 },

  // Lookup
  cameraBtn: {
    backgroundColor: '#0c4a2a', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  cameraBtnText: { fontSize: 16, color: Colors.accent2, fontWeight: '700' },
  cancelCameraBtn: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelCameraBtnText: { fontSize: 13, color: Colors.text2, fontWeight: '600' },
  cameraPlaceholder: {
    flex: 1, backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  permText:    { color: Colors.text2, fontSize: 14 },
  permBtn:     { backgroundColor: Colors.accent, borderRadius: 8, padding: 10 },
  permBtnText: { color: '#000', fontWeight: '700' },

  input: {
    backgroundColor: Colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 15,
    padding: 14,
  },
  searchBtn: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    width: 52, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 20 },

  errorBox: {
    backgroundColor: '#450a0a', borderRadius: 10,
    borderWidth: 1, borderColor: '#dc2626',
    padding: 12,
  },
  errorText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },

  resultCard: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: '#2d6a45',
    padding: 16,
  },
  resultName: { fontSize: 16, fontWeight: '700', color: Colors.text1, flex: 1 },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: Colors.bg3,
  },
  resultLabel: { fontSize: 12, color: Colors.text3 },
  resultValue: { fontSize: 13, color: Colors.text1, fontWeight: '600', flex: 1, textAlign: 'right' },
  resetBtn:    { padding: 4, marginLeft: 8 },
  resetBtnText: { fontSize: 18, color: Colors.text3 },

  lookupHint: { alignItems: 'center', paddingTop: 40 },
  lookupHintIcon: { fontSize: 48, marginBottom: 12 },
  lookupHintText: {
    fontSize: 14, color: Colors.text3,
    textAlign: 'center', lineHeight: 22, paddingHorizontal: 20,
  },
})
