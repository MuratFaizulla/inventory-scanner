// Акты вокруг модуля акта: создание, запуск/пауза/завершение, справочники,
// статистика по кабинетам, поиск ОС. Работа внутри акта (скан, перемещение,
// отмена, копия акта и очередь) — в модуле акта, constants/act.
import api from './api'
import { acts, type ActItem, type ActSummary } from './act'
import { cachedFetch } from './cachedFetch'

const READ_TIMEOUT = 10000

// ── Создание и жизненный цикл акта — только с сетью ─────────────────────────

export interface CreateSessionInput {
  title: string
  conductedBy?: string
  mol?: string
  employee?: string
  locationFilter?: string
  notes?: string
}

export const createSession = async (input: CreateSessionInput): Promise<ActSummary> => {
  const res = await api.post('/inventory-sessions', input)
  return res.data.data
}

// Завершение — не здесь, а act.complete(): сначала надо дослать очередь акта
export const sessionAction = async (
  id: number,
  action: 'start' | 'pause' | 'resume' | 'cancel',
): Promise<ActSummary> => {
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

// ── Справочники для перемещения: названия кабинетов и ФИО сотрудников ─────────

// Пустые и повторы убираем: выбор в модалке идёт по названию
const uniqueNames = (names: (string | null)[]) =>
  [...new Set(names.map(n => n?.trim()).filter((n): n is string => !!n))]

export const getLocations = async (): Promise<string[]> =>
  uniqueNames(await cachedFetch<string[]>('locations', async () => {
    const res = await api.get('/inventory/locations', { timeout: READ_TIMEOUT })
    return res.data.data ?? []
  }))

export const getEmployees = async (): Promise<string[]> =>
  uniqueNames(await cachedFetch<string[]>('employees', async () => {
    const res = await api.get('/inventory/names', { timeout: READ_TIMEOUT })
    return res.data.data?.responsible ?? []
  }))

// ── Статистика по кабинетам (считаем из позиций акта) ────────────────────────

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

const toStatAsset = (item: ActItem): StatAsset => ({
  id: item.id,
  itemId: item.id,
  name: item.name ?? '—',
  inventoryNumber: item.invNumber ?? '—',
  barcode: item.barcode,
  responsiblePerson: item.mol,
  employee: item.employee,
  scannedAt: item.scannedAt,
  scannedBy: item.scannedBy,
  note: item.note,
})

export const getStatsByLocation = async (actId: number | string) => {
  const { items } = await acts.open(Number(actId)).refresh()

  type Bucket = {
    totalAssets: StatAsset[]
    foundAssets: StatAsset[]
    notFoundAssets: StatAsset[]
    misplacedAssets: StatAsset[]
    pendingAssets: StatAsset[]
  }
  const map = new Map<string, Bucket>()

  for (const item of items) {
    const loc = item.location ?? '—'
    if (!map.has(loc)) {
      map.set(loc, {
        totalAssets: [], foundAssets: [], notFoundAssets: [],
        misplacedAssets: [], pendingAssets: [],
      })
    }
    const b = map.get(loc)!
    const a = toStatAsset(item)
    b.totalAssets.push(a)
    if (item.status === 'found')     b.foundAssets.push(a)
    if (item.status === 'not_found') b.notFoundAssets.push(a)
    // Излишки — вместе с «не на месте», как во вкладках деталей акта
    if (item.status === 'misplaced' || item.status === 'surplus') b.misplacedAssets.push(a)
    if (item.status === 'pending')   b.pendingAssets.push(a)
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
