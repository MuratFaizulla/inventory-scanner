// Адаптер сканера под наш бэкенд (modules/inventory-session, modules/inventory).
// UI-компоненты писались под старый бэкенд — здесь конвертируем формы данных.
import api from './api'

// ── Формат бэкенда ───────────────────────────────────────────────────────────

// mapItem() из inventory-session.service.ts
export interface RawItem {
  id: number
  invNumber: string | null
  barcode: string | null
  description: string | null
  expectedLocation: string | null
  actualLocation: string | null
  correctedLocation: string | null
  correctedEmployee: string | null
  mol: string | null
  employee: string | null
  status: 'pending' | 'found' | 'not_found' | 'misplaced' | 'surplus'
  scannedAt: string | null
  scannedBy: string | null
  note: string | null
}

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

export const listSessions = async (): Promise<RawSession[]> => {
  const res = await api.get('/inventory-sessions')
  return res.data.data ?? []
}

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

// Детали сессии в форме SessionDetail-источника (session/[id].tsx)
export const getSessionDetail = async (id: number | string) => {
  const res = await api.get(`/inventory-sessions/${id}`)
  const s = res.data.data as RawSession & { items: RawItem[] }
  return {
    id: s.id,
    name: s.title,
    status: s.status.toUpperCase(),
    location: s.locationFilter ? { name: s.locationFilter } : { name: 'Вся школа' },
    items: (s.items ?? []).map(toUiItem),
    raw: s,
  }
}

// ── Сканирование ─────────────────────────────────────────────────────────────

// POST :id/scan → { status, alreadyScanned, item }
export const scanCode = async (sessionId: number | string, code: string) => {
  const res = await api.post(`/inventory-sessions/${sessionId}/scan`, {
    barcode: code,
    invNumber: code,
  })
  return res.data.data as {
    status: RawItem['status']
    alreadyScanned: boolean
    item: RawItem
  }
}

// Правка позиции (перемещение) — строки, не ID
export const updateItem = async (
  sessionId: number | string,
  itemId: number,
  patch: { location?: string; employee?: string },
) => {
  const res = await api.patch(`/inventory-sessions/${sessionId}/items/${itemId}`, patch)
  return res.data.data as RawItem
}

// Отмена скана → позиция снова pending (излишек удаляется)
export const unscanItem = async (sessionId: number | string, itemId: number) => {
  const res = await api.post(`/inventory-sessions/${sessionId}/items/${itemId}/unscan`)
  return res.data.data
}

// ── Справочники для RelocateModal (UI ждёт {id,name} / {id,fullName}) ───────

export const getLocationOptions = async (): Promise<{ id: number; name: string }[]> => {
  const res = await api.get('/inventory/locations')
  return ((res.data.data ?? []) as string[]).map((name, i) => ({ id: i + 1, name }))
}

export const getEmployeeOptions = async (): Promise<{ id: number; fullName: string }[]> => {
  const res = await api.get('/inventory/names')
  const names: string[] = res.data.data?.responsible ?? []
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
