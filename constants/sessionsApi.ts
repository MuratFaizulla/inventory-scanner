// Адаптер сканера под наш бэкенд (modules/inventory-session, modules/inventory).
// UI-компоненты писались под старый бэкенд — здесь конвертируем формы данных.
//
// Акты работают и без сети (offline.ts): списки и акт отдаются из копии на
// телефоне, а скан / перемещение / отмена встают в очередь и досылаются сами.
import api from './api'
import {
  READ_TIMEOUT, SEND_TIMEOUT,
  cachedFetch, enqueue, getOfflineState, hasPending, isOfflineError, offlineUser,
  patchSessionItems, pendingOps, readCache, replaceMine, sessionKey, setOnline,
} from './offline'
import {
  type RawItem,
  itemCode, predictScan, removeItem, replay, upsertItem, withoutQueuedScan,
} from './offlineCore'

export type { RawItem }

// ── Формат бэкенда ───────────────────────────────────────────────────────────

export interface RawSession {
  id: number
  title: string
  status: 'draft' | 'in_progress' | 'paused' | 'completed' | 'cancelled'
  createdBy: string
  conductedBy: string | null
  mol: string | null
  employee: string | null
  locationFilter: string | null
  notes: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  total?: number
  scanned?: number
}

// ── Конвертация в формы, которые ждёт UI ─────────────────────────────────────

const STATUS_UP: Record<string, string> = {
  pending: 'PENDING',
  found: 'FOUND',
  not_found: 'NOT_FOUND',
  misplaced: 'MISPLACED',
  surplus: 'MISPLACED', // излишки показываем во вкладке «Не на месте»
}

// components/session/types.ts → Item
export const toUiItem = (r: RawItem) => ({
  id: r.id,
  status: STATUS_UP[r.status] ?? 'PENDING',
  note: r.note,
  scannedAt: r.scannedAt,
  scannedBy: r.scannedBy,
  queued: !!r.queued,
  asset: {
    id: r.id, // перемещение/отмена идут по item id
    inventoryNumber: r.invNumber ?? '—',
    name: r.description ?? '—',
    barcode: r.barcode,
    location: { name: r.correctedLocation || r.expectedLocation || '—' },
    responsiblePerson: { fullName: r.mol || '—' },
    employee: { fullName: r.correctedEmployee || r.employee || '—' },
  },
})

// ── Сессии ───────────────────────────────────────────────────────────────────

export const listSessions = (): Promise<RawSession[]> =>
  cachedFetch('sessions', async () => {
    const res = await api.get('/inventory-sessions', { timeout: READ_TIMEOUT })
    return res.data.data ?? []
  })

export interface CreateSessionInput {
  title: string
  conductedBy?: string
  mol?: string
  employee?: string
  locationFilter?: string
  notes?: string
}

export const createSession = async (input: CreateSessionInput): Promise<RawSession> => {
  const res = await api.post('/inventory-sessions', input)
  return res.data.data
}

export const sessionAction = async (
  id: number,
  action: 'start' | 'pause' | 'resume' | 'complete' | 'cancel',
): Promise<RawSession> => {
  const res = await api.post(`/inventory-sessions/${id}/${action}`)
  return res.data.data
}

// Каскадные списки для модалки создания: { mols, employees, locations }
export const getCreateOptions = async (mol?: string, employee?: string) => {
  const res = await api.get('/inventory-sessions/options', {
    params: { ...(mol && { mol }), ...(employee && { employee }) },
  })
  return res.data.data as { mols: string[]; employees: string[]; locations: string[] }
}

export const previewSession = async (opts: {
  location?: string
  mol?: string
  employee?: string
}) => {
  const res = await api.get('/inventory-sessions/preview', { params: opts })
  return res.data.data as { total: number }
}

type RawDetail = RawSession & { items: RawItem[] }

// Копия акта с сервера (или с телефона, если связи нет) + неотправленная очередь
const sessionView = async (id: number | string) => {
  const s = await cachedFetch<RawDetail>(sessionKey(Number(id)), async () => {
    const res = await api.get(`/inventory-sessions/${id}`, { timeout: READ_TIMEOUT })
    return res.data.data
  })
  return { ...s, items: replay(s.items ?? [], pendingOps(Number(id))) }
}

// Детали сессии в форме SessionDetail-источника (session/[id].tsx).
// Заодно сохраняет акт на телефон — сканер вызывает её при открытии.
export const getSessionDetail = async (id: number | string) => {
  const s = await sessionView(id)
  return {
    id: s.id,
    name: s.title,
    status: s.status.toUpperCase(),
    location: s.locationFilter ? { name: s.locationFilter } : { name: 'Вся школа' },
    items: s.items.map(toUiItem),
    raw: s,
  }
}

// Копия акта без сети — для операций из очереди
const offlineView = async (sessionId: number) => {
  const s = await readCache<RawDetail>(sessionKey(sessionId))
  if (!s) {
    throw new Error('Нет связи с сервером, а этот акт не сохранён на телефоне. Откройте его один раз при подключении к Wi-Fi.')
  }
  return { ...s, items: replay(s.items ?? [], pendingOps(sessionId)) }
}

// Пока в очереди есть операции этого акта, новые встают за ними — иначе
// перемещение может уйти раньше скана, к которому относится. Связи нет —
// сразу в очередь: ждать таймаут на каждом скане при слабом Wi-Fi незачем,
// возврат связи заметит фоновая досылка (useAutoSync)
const tryOnline = async <T>(sessionId: number, send: () => Promise<T>): Promise<T | undefined> => {
  if (hasPending(sessionId) || !getOfflineState().online) return undefined
  try {
    const data = await send()
    setOnline(true)
    return data
  } catch (e) {
    if (!isOfflineError(e)) throw e
    setOnline(false)
    return undefined
  }
}

// ── Сканирование ─────────────────────────────────────────────────────────────

export type ScanOutcome = {
  // unknown — без сети, и кода нет в копии акта: излишек или ОС нет в базе
  status: RawItem['status'] | 'unknown'
  alreadyScanned: boolean
  item: RawItem
  queued: boolean   // скан на телефоне, уйдёт на сервер, когда будет связь
}

// POST :id/scan → { status, alreadyScanned, item }
export const scanCode = async (sessionId: number | string, code: string): Promise<ScanOutcome> => {
  const sid = Number(sessionId)
  const online = await tryOnline(sid, async () => {
    const res = await api.post(
      `/inventory-sessions/${sid}/scan`,
      { barcode: code, invNumber: code },
      { timeout: SEND_TIMEOUT },
    )
    return res.data.data as { status: RawItem['status']; alreadyScanned: boolean; item: RawItem }
  })
  if (online) {
    void patchSessionItems(sid, items => upsertItem(items, online.item))
    return { ...online, queued: false }
  }

  const view = await offlineView(sid)
  if (view.status !== 'in_progress') throw new Error('Сканировать можно только в запущенной сессии')
  const at = new Date().toISOString()
  const p = predictScan(view.items, code, at, offlineUser())
  if (!p.alreadyScanned) await enqueue({ kind: 'scan', sessionId: sid, code, at })
  return { ...p, queued: !p.alreadyScanned }
}

// Правка позиции (перемещение) — строки, не ID.
// queued — правка пока на телефоне, уйдёт, когда будет связь
export const updateItem = async (
  sessionId: number | string,
  itemId: number,
  patch: { location?: string; employee?: string },
): Promise<{ queued: boolean }> => {
  const sid = Number(sessionId)
  const online = itemId > 0
    ? await tryOnline(sid, async () => {
        const res = await api.patch(`/inventory-sessions/${sid}/items/${itemId}`, patch, { timeout: SEND_TIMEOUT })
        return res.data.data as RawItem
      })
    : undefined
  if (online) {
    void patchSessionItems(sid, items => upsertItem(items, online))
    return { queued: false }
  }

  const it = (await offlineView(sid)).items.find(i => i.id === itemId)
  if (!it) throw new Error('Позиция не найдена в копии акта')
  await enqueue({
    kind: 'update', sessionId: sid, code: itemCode(it),
    itemId: itemId > 0 ? itemId : null, patch, at: new Date().toISOString(),
  })
  return { queued: true }
}

// Отмена скана → позиция снова pending (излишек удаляется)
export const unscanItem = async (sessionId: number | string, itemId: number) => {
  const sid = Number(sessionId)

  // Скан ещё не ушёл — просто забываем его, серверу знать незачем
  if (hasPending(sid)) {
    const it = (await offlineView(sid)).items.find(i => i.id === itemId)
    const left = it && withoutQueuedScan(pendingOps(sid), sid, it)
    if (left) {
      await replaceMine(sid, left)
      return
    }
  }

  const online = itemId > 0
    ? await tryOnline(sid, async () => {
        const res = await api.post(`/inventory-sessions/${sid}/items/${itemId}/unscan`, undefined, { timeout: SEND_TIMEOUT })
        return res.data.data as { deleted: boolean; item?: RawItem }
      })
    : undefined
  if (online) {
    void patchSessionItems(sid, items =>
      online.deleted || !online.item ? removeItem(items, itemId) : upsertItem(items, online.item))
    return
  }

  const it = (await offlineView(sid)).items.find(i => i.id === itemId)
  if (!it) throw new Error('Позиция не найдена в копии акта')
  await enqueue({
    kind: 'unscan', sessionId: sid, code: itemCode(it),
    itemId: itemId > 0 ? itemId : null, at: new Date().toISOString(),
  })
}

// ── Справочники для RelocateModal (UI ждёт {id,name} / {id,fullName}) ───────

export const getLocationOptions = async (): Promise<{ id: number; name: string }[]> => {
  const names = await cachedFetch<string[]>('locations', async () => {
    const res = await api.get('/inventory/locations', { timeout: READ_TIMEOUT })
    return res.data.data ?? []
  })
  return names.map((name, i) => ({ id: i + 1, name }))
}

export const getEmployeeOptions = async (): Promise<{ id: number; fullName: string }[]> => {
  const names = await cachedFetch<string[]>('employees', async () => {
    const res = await api.get('/inventory/names', { timeout: READ_TIMEOUT })
    return res.data.data?.responsible ?? []
  })
  return names.map((fullName, i) => ({ id: i + 1, fullName }))
}

// ── Статистика по кабинетам (считаем из позиций сессии) ─────────────────────

type StatAsset = {
  id: number
  itemId: number
  name: string
  inventoryNumber: string
  barcode: string | null
  responsiblePerson: string | null
  employee: string | null
  scannedAt: string | null
  scannedBy: string | null
  note: string | null
}

const toStatAsset = (item: ReturnType<typeof toUiItem>): StatAsset => ({
  id: item.id,
  itemId: item.id,
  name: item.asset.name,
  inventoryNumber: item.asset.inventoryNumber,
  barcode: item.asset.barcode,
  responsiblePerson: item.asset.responsiblePerson.fullName,
  employee: item.asset.employee?.fullName ?? null,
  scannedAt: item.scannedAt,
  scannedBy: item.scannedBy,
  note: item.note,
})

export const getStatsByLocation = async (sessionId: number | string) => {
  const detail = await getSessionDetail(sessionId)

  type Bucket = {
    totalAssets: StatAsset[]
    foundAssets: StatAsset[]
    notFoundAssets: StatAsset[]
    misplacedAssets: StatAsset[]
    pendingAssets: StatAsset[]
  }
  const map = new Map<string, Bucket>()

  for (const item of detail.items) {
    const loc = item.asset.location.name
    if (!map.has(loc)) {
      map.set(loc, {
        totalAssets: [], foundAssets: [], notFoundAssets: [],
        misplacedAssets: [], pendingAssets: [],
      })
    }
    const b = map.get(loc)!
    const a = toStatAsset(item)
    b.totalAssets.push(a)
    if (item.status === 'FOUND')     b.foundAssets.push(a)
    if (item.status === 'NOT_FOUND') b.notFoundAssets.push(a)
    if (item.status === 'MISPLACED') b.misplacedAssets.push(a)
    if (item.status === 'PENDING')   b.pendingAssets.push(a)
  }

  return [...map.entries()]
    .map(([locationName, b], i) => {
      const total = b.totalAssets.length
      const found = b.foundAssets.length
      return {
        locationId: i + 1,
        locationName,
        total,
        found,
        notFound: b.notFoundAssets.length,
        misplaced: b.misplacedAssets.length,
        pending: b.pendingAssets.length,
        progress: total > 0 ? Math.round((found / total) * 100) : 0,
        ...b,
      }
    })
    .sort((a, b) => b.total - a.total)
}

// ── Поиск ОС по коду (вкладка «Поиск») ───────────────────────────────────────

export const lookupAsset = async (code: string) => {
  const res = await api.get('/inventory/assets', {
    params: { type: 'fixed', q: code, limit: 5 },
  })
  const items = (res.data.data ?? []) as Array<{
    id: number
    name: string | null
    inventoryNumber: string | null
    barcode: string | null
    location: { name: string } | null
    sn: string | null
    dateFix: string | null
    person: string | null
    accountablePerson: string | null
    photoPath: string | null
  }>
  if (!items.length) return null
  // Точное совпадение по штрих-коду/инв.номеру приоритетнее ILIKE-совпадений
  const exact = items.find(a => a.barcode === code || a.inventoryNumber === code)
  const a = exact ?? items[0]
  // Форма LookupResult (components/sessions/types.ts)
  return {
    id: a.id,
    name: a.name ?? '—',
    inventoryNumber: a.inventoryNumber ?? '—',
    barcode: a.barcode,
    assetType: a.name ?? '—',
    assetFaType: null,
    factoryNumber: a.sn,
    accountingAccount: null,
    bookValue: null,
    residualValue: null,
    depreciationPercent: null,
    acceptanceDate: a.dateFix,
    location: a.location,
    employee: a.person ? { fullName: a.person } : null,
    responsiblePerson: a.accountablePerson ? { fullName: a.accountablePerson } : null,
    organization: null,
    photoKey: null,
    photoPath: a.photoPath,
  }
}
