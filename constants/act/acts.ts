// Модуль акта: всё, что телефон делает с актами инвентаризации, — с сетью и
// без. Экраны видят список актов, позиции акта и три действия: скан,
// перемещение, отмена скана. Сеть, копия акта, очередь и досылка — внутри.
// Термины — CONTEXT.md.
//
// React Native модуль не знает: сервер и хранилище подаются снаружи. В проде
// это адаптеры из http.ts и index.ts, в тестах (acts.test.mjs) — в памяти.
import {
  type ActCounts, type ActItem, type FailedOp, type ItemStatus, type Op, type OpPatch, type RawItem,
  countItems, findByCode, itemCode, predictScan, removeItem, replay, toActItem,
  upsertItem, withoutQueuedScan,
} from './rules.ts'

export type { ActCounts, ActItem, FailedOp, ItemStatus, OpPatch, RawItem }

// ── Шов: сервер ─────────────────────────────────────────────────────────────

/** Связи нет: нет ответа, таймаут, «бэкенд запускается». Операцию откладываем. */
export class OfflineError extends Error {}

/** Сервер отказал; message — текст для человека. */
export class ServerError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Вход истёк и не продлился — досылка ждёт нового входа. */
export class AuthError extends Error {}

export type ActStatus = 'draft' | 'in_progress' | 'paused' | 'completed' | 'cancelled'

export interface ActSummary {
  id: number
  title: string
  status: ActStatus
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

export type ActDetail = ActSummary & { items: RawItem[] }

export type ServerScan = { status: ItemStatus; alreadyScanned: boolean; item: RawItem }

export interface ActServer {
  list(): Promise<ActSummary[]>
  get(actId: number): Promise<ActDetail>
  /** scannedAt — только у скана из очереди: время скана на телефоне */
  scan(actId: number, code: string, scannedAt?: string): Promise<ServerScan>
  update(actId: number, itemId: number, patch: OpPatch): Promise<RawItem>
  unscan(actId: number, itemId: number): Promise<{ deleted: boolean; item?: RawItem }>
  /** Есть ли связь: любой ответ сервера — да */
  ping(): Promise<void>
}

// ── Шов: хранилище на телефоне ──────────────────────────────────────────────

export interface Store {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

// ── Интерфейс ───────────────────────────────────────────────────────────────

export interface ActView {
  act: ActSummary
  items: ActItem[]
  counts: ActCounts
}

export type ScanOutcome =
  | { kind: 'found' | 'misplaced' | 'surplus'; item: ActItem; queued: boolean }
  | { kind: 'already'; item: ActItem }
  /** без связи, и кода нет в копии акта: скан в очереди, излишек или нет — решит сервер */
  | { kind: 'unknown'; code: string }
  /** сервер: такого ОС нет в базе */
  | { kind: 'not_found'; code: string }

export interface Act {
  /** Последнее известное состояние; null — копии ещё нет */
  view(): ActView | null
  /** С сервера (и в копию), без связи — из копии */
  refresh(): Promise<ActView>
  scan(code: string): Promise<ScanOutcome>
  relocate(itemId: number, patch: OpPatch): Promise<{ queued: boolean }>
  cancel(itemId: number): Promise<void>
  subscribe(listener: () => void): () => void
}

export interface SyncState {
  online: boolean
  syncing: boolean
  queued: number        // операций текущего пользователя в очереди
  failed: FailedOp[]    // не принято сервером
}

export interface Acts {
  /** Прочитать очередь: при старте и после входа (сменился владелец очереди) */
  init(): Promise<void>
  /** Список актов; пока есть связь, запущенные акты сохраняются на телефон */
  list(): Promise<ActSummary[]>
  open(actId: number): Act
  sync: {
    state(): SyncState
    subscribe(listener: () => void): () => void
    /** «Отправить сейчас» */
    now(): Promise<void>
    /** Фоновый вызов: досылка, если есть очередь; проверка связи, если её нет */
    tick(): Promise<void>
    dismissFailed(): Promise<void>
  }
}

// ── Реализация ──────────────────────────────────────────────────────────────

// Ключи — как у первой версии оффлайна (24.09.2026): очередь и копии актов,
// сохранённые телефонами до этой версии, подхватываются как есть
const KEY = {
  outbox: 'offlineOutbox',
  failed: 'offlineFailed',
  list: 'sessions',
  act: (id: number) => `session-${id}`,
}

const NO_COPY = 'Нет связи с сервером, а этот акт не сохранён на телефоне. Откройте его один раз при подключении к Wi-Fi.'
const NO_LIST = 'Нет связи с сервером, а список актов ещё не сохранён на телефоне.'
const NOT_RUNNING = 'Сканировать можно только в запущенном акте'
const NO_ITEM = 'Позиция не найдена в копии акта'

// Операция из первой версии оффлайна: акт назывался sessionId
type StoredOp = Op & { sessionId?: number }

type NewOp = Op extends infer O ? (O extends Op ? Omit<O, 'id' | 'user'> : never) : never

export function createActs(deps: {
  server: ActServer
  store: Store
  /** Логин, от имени которого идут операции; '' — никто не вошёл */
  currentUser: () => string
  now?: () => Date
}): Acts {
  const { server, store, currentUser } = deps
  const now = deps.now ?? (() => new Date())

  // ── состояние досылки ──
  let outbox: Op[] = []
  let failed: FailedOp[] = []
  let online = true
  let syncing = false
  let seq = 0
  const syncListeners = new Set<() => void>()

  const mine = () => {
    const user = currentUser()
    return user ? outbox.filter(o => o.user === user) : []
  }
  const pendingFor = (actId: number) => mine().filter(o => o.actId === actId)

  let syncSnapshot: SyncState = { online, syncing, queued: 0, failed }
  const emitSync = () => {
    syncSnapshot = { online, syncing, queued: mine().length, failed }
    syncListeners.forEach(l => l())
  }
  const setOnline = (v: boolean) => {
    if (online === v) return
    online = v
    emitSync()
  }

  // ── хранилище ──
  const readJson = async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await store.get(key)
      return raw == null ? null : (JSON.parse(raw) as T)
    } catch {
      return null
    }
  }
  const writeJson = async (key: string, value: unknown) => {
    try {
      await store.set(key, JSON.stringify(value))
    } catch {
      // Место кончилось — в памяти всё есть, до перезапуска работать можно
    }
  }

  // Копии актов: в памяти — вместе с JSON, чтобы не переписывать файл, когда
  // сервер вернул то же самое (детали акта обновляются каждые 5 секунд)
  const copies = new Map<number, { json: string; detail: ActDetail }>()

  async function loadCopy(actId: number): Promise<ActDetail | null> {
    const hit = copies.get(actId)
    if (hit) return hit.detail
    const detail = await readJson<ActDetail>(KEY.act(actId))
    if (detail) copies.set(actId, { json: JSON.stringify(detail), detail })
    return detail
  }

  async function saveCopy(actId: number, detail: ActDetail) {
    const json = JSON.stringify(detail)
    if (copies.get(actId)?.json === json) return
    copies.set(actId, { json, detail })
    try {
      await store.set(KEY.act(actId), json)
    } catch { /* см. writeJson */ }
  }

  async function patchCopy(actId: number, fn: (items: RawItem[]) => RawItem[]) {
    const d = await loadCopy(actId)
    if (d) await saveCopy(actId, { ...d, items: fn(d.items ?? []) })
  }

  // Позиции копии с применённой очередью — то, что видит человек
  async function currentItems(actId: number): Promise<{ detail: ActDetail; items: RawItem[] }> {
    const detail = await loadCopy(actId)
    if (!detail) throw new OfflineError(NO_COPY)
    return { detail, items: replay(detail.items ?? [], pendingFor(actId)) }
  }

  // ── очередь ──
  async function persistQueue() {
    emitSync()
    await Promise.all([writeJson(KEY.outbox, outbox), writeJson(KEY.failed, failed)])
  }

  async function enqueue(op: NewOp) {
    outbox = [...outbox, { ...op, id: `${now().getTime()}-${++seq}`, user: currentUser() } as Op]
    await persistQueue()
    await handles.get(op.actId)?.recompute()
    void syncNow()
  }

  // Запрос к серверу: результат — или OFFLINE, если связи нет
  const OFFLINE = Symbol('offline')
  async function attempt<T>(fn: () => Promise<T>): Promise<T | typeof OFFLINE> {
    try {
      const r = await fn()
      setOnline(true)
      return r
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e
      setOnline(false)
      return OFFLINE
    }
  }

  // Пока в очереди есть операции акта, новые встают за ними — иначе
  // перемещение уйдёт раньше скана, к которому относится. Связи нет —
  // сразу в очередь: ждать таймаут на каждом скане незачем
  const direct = (actId: number) => online && pendingFor(actId).length === 0

  // ── акты ──
  type Handle = { act: Act; recompute: () => Promise<void> }
  const handles = new Map<number, Handle>()

  function open(actId: number): Act {
    const existing = handles.get(actId)
    if (existing) return existing.act

    const listeners = new Set<() => void>()
    let current: ActView | null = null

    async function recompute() {
      const detail = await loadCopy(actId)
      if (!detail) return
      const { items: _raw, ...act } = detail
      const items = replay(detail.items ?? [], pendingFor(actId)).map(toActItem)
      current = { act, items, counts: countItems(items) }
      listeners.forEach(l => l())
    }

    const act: Act = {
      view: () => current,

      async refresh() {
        const r = await attempt(() => server.get(actId))
        if (r !== OFFLINE) await saveCopy(actId, r)
        else if (!(await loadCopy(actId))) throw new OfflineError(NO_COPY)
        await recompute()
        return current!
      },

      async scan(code) {
        if (direct(actId)) {
          try {
            const r = await attempt(() => server.scan(actId, code))
            if (r !== OFFLINE) {
              await patchCopy(actId, items => upsertItem(items, r.item))
              await recompute()
              const item = toActItem(r.item)
              if (r.alreadyScanned) return { kind: 'already', item }
              return { kind: r.status as 'found' | 'misplaced' | 'surplus', item, queued: false }
            }
          } catch (e) {
            if (e instanceof ServerError && e.status === 404) return { kind: 'not_found', code }
            throw e
          }
        }

        const { detail, items } = await currentItems(actId)
        if (detail.status !== 'in_progress') throw new Error(NOT_RUNNING)
        const at = now().toISOString()
        const p = predictScan(items, code, at, currentUser())
        if (p.alreadyScanned) return { kind: 'already', item: toActItem(p.item) }
        await enqueue({ kind: 'scan', actId, code, at })
        if (p.status === 'unknown') return { kind: 'unknown', code }
        return { kind: p.status as 'found' | 'misplaced' | 'surplus', item: toActItem(p.item), queued: true }
      },

      async relocate(itemId, patch) {
        if (itemId > 0 && direct(actId)) {
          const r = await attempt(() => server.update(actId, itemId, patch))
          if (r !== OFFLINE) {
            await patchCopy(actId, items => upsertItem(items, r))
            await recompute()
            return { queued: false }
          }
        }
        const it = (await currentItems(actId)).items.find(i => i.id === itemId)
        if (!it) throw new Error(NO_ITEM)
        await enqueue({
          kind: 'update', actId, code: itemCode(it),
          itemId: itemId > 0 ? itemId : null, patch, at: now().toISOString(),
        })
        return { queued: true }
      },

      async cancel(itemId) {
        // Скан ещё не ушёл — просто забываем его, серверу знать незачем
        const pending = pendingFor(actId)
        if (pending.length) {
          const it = (await currentItems(actId)).items.find(i => i.id === itemId)
          const left = it && withoutQueuedScan(pending, actId, it)
          if (left) {
            const user = currentUser()
            outbox = [...outbox.filter(o => o.user !== user || o.actId !== actId), ...left]
            await persistQueue()
            await recompute()
            return
          }
        }

        if (itemId > 0 && direct(actId)) {
          const r = await attempt(() => server.unscan(actId, itemId))
          if (r !== OFFLINE) {
            await patchCopy(actId, items =>
              r.deleted || !r.item ? removeItem(items, itemId) : upsertItem(items, r.item))
            await recompute()
            return
          }
        }
        const it = (await currentItems(actId)).items.find(i => i.id === itemId)
        if (!it) throw new Error(NO_ITEM)
        await enqueue({
          kind: 'unscan', actId, code: itemCode(it),
          itemId: itemId > 0 ? itemId : null, at: now().toISOString(),
        })
      },

      subscribe(listener) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    }

    handles.set(actId, { act, recompute })
    void recompute()
    return act
  }

  // ── досылка ──

  // id позиции на сервере: у скана не из акта он появится только после досылки
  async function resolveItemId(op: Extract<Op, { itemId: number | null }>) {
    if (op.itemId != null && op.itemId > 0) return op.itemId
    const d = await loadCopy(op.actId)
    const it = d && findByCode(d.items ?? [], op.code)
    if (!it || it.id < 0) throw new Error(`Код ${op.code}: скан не прошёл — изменять нечего`)
    return it.id
  }

  async function send(op: Op) {
    if (op.kind === 'scan') {
      const r = await server.scan(op.actId, op.code, op.at)
      await patchCopy(op.actId, items => upsertItem(items, r.item))
      return
    }
    const itemId = await resolveItemId(op)
    if (op.kind === 'update') {
      const r = await server.update(op.actId, itemId, op.patch)
      await patchCopy(op.actId, items => upsertItem(items, r))
      return
    }
    try {
      const r = await server.unscan(op.actId, itemId)
      await patchCopy(op.actId, items =>
        r.deleted || !r.item ? removeItem(items, itemId) : upsertItem(items, r.item))
    } catch (e) {
      // Излишек уже удалён: прошлая досылка дошла, а ответ — нет
      if (!(e instanceof ServerError && e.status === 404)) throw e
      await patchCopy(op.actId, items => removeItem(items, itemId))
    }
  }

  async function runSync() {
    if (!mine().length) return
    syncing = true
    emitSync()
    try {
      for (let op = mine()[0]; op; op = mine()[0]) {
        try {
          await send(op)
          setOnline(true)
        } catch (e) {
          if (e instanceof OfflineError) {
            setOnline(false)
            return
          }
          if (e instanceof AuthError) return
          failed = [...failed, { ...op, error: (e as Error).message, failedAt: now().toISOString() }]
        }
        const sent = op
        outbox = outbox.filter(o => o.id !== sent.id)
        await persistQueue()
        await handles.get(sent.actId)?.recompute()
      }
    } finally {
      syncing = false
      emitSync()
    }
  }

  // Одна досылка за раз. Позвали во время прогона (связь вернулась, пока
  // прошлый прогон упирался в её отсутствие) — после него будет ещё один,
  // иначе вызов получил бы заведомо неудачный старый прогон
  let running: Promise<void> | null = null
  let rerun = false
  function syncNow(): Promise<void> {
    if (running) {
      rerun = true
      return running
    }
    running = (async () => {
      do {
        rerun = false
        await runSync()
      } while (rerun)
    })().finally(() => { running = null })
    return running
  }

  return {
    async init() {
      const [o, f] = await Promise.all([
        readJson<StoredOp[]>(KEY.outbox),
        readJson<(FailedOp & { sessionId?: number })[]>(KEY.failed),
      ])
      const legacy = <T extends { actId: number; sessionId?: number }>(x: T): T =>
        x.actId == null && x.sessionId != null ? { ...x, actId: x.sessionId } : x
      outbox = (o ?? []).map(legacy)
      failed = (f ?? []).map(legacy)
      emitSync()
      await Promise.all([...handles.values()].map(h => h.recompute()))
    },

    async list() {
      const r = await attempt(() => server.list())
      if (r === OFFLINE) {
        const cached = await readJson<ActSummary[]>(KEY.list)
        if (!cached) throw new OfflineError(NO_LIST)
        return cached
      }
      await writeJson(KEY.list, r)
      // Пока есть связь — запущенные акты на телефон: в кабинете без Wi-Fi
      // сканировать можно, даже не открывая акт заранее
      for (const a of r) {
        if (a.status === 'in_progress') void open(a.id).refresh().catch(() => {})
      }
      return r
    },

    open,

    sync: {
      state: () => syncSnapshot,
      subscribe(listener) {
        syncListeners.add(listener)
        return () => { syncListeners.delete(listener) }
      },
      now: syncNow,
      async tick() {
        if (mine().length) return syncNow()
        if (online) return
        try {
          await server.ping()
          setOnline(true)
        } catch (e) {
          setOnline(!(e instanceof OfflineError))
        }
      },
      async dismissFailed() {
        failed = []
        await persistQueue()
      },
    },
  }
}
