// Оффлайн-режим: копии данных на телефоне, очередь операций и её досылка.
// Правила применения операций к копии акта — в offlineCore.ts.
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { useEffect, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import api, { getApiBase, hasTokens } from './api'
import {
  type FailedOp, type Op, type RawItem,
  findByCode, removeItem, upsertItem,
} from './offlineCore'

// Сколько ждать ответа, прежде чем считать, что связи нет: при слабом Wi-Fi
// запрос висит минуту — сканировать столько никто не будет
export const SEND_TIMEOUT = 6000
export const READ_TIMEOUT = 10000

// Нет ответа, таймаут или nginx говорит «бэкенд запускается» —
// всё это «нет связи»: операцию надо отложить, а не выдавать ошибку
export const isOfflineError = (e: unknown) =>
  axios.isAxiosError(e) && (!e.response || [502, 503, 504].includes(e.response.status))

// ── Копии данных ─────────────────────────────────────────────────────────────
// Акт «Вся школа» — тысячи позиций. AsyncStorage на Android не читает значение
// больше ~2 МБ (CursorWindow) и весь ограничен 6 МБ — поэтому на телефоне
// копии лежат файлами, а на вебе — в localStorage через AsyncStorage.

const memo = new Map<string, unknown>()

const filePath = async (key: string) => {
  const FS = await import('expo-file-system/legacy')
  return { FS, dir: `${FS.documentDirectory}offline/`, path: `${FS.documentDirectory}offline/${key}.json` }
}

export async function readCache<T>(key: string): Promise<T | null> {
  if (memo.has(key)) return memo.get(key) as T
  try {
    let raw: string | null
    if (Platform.OS === 'web') {
      raw = await AsyncStorage.getItem(`offline:${key}`)
    } else {
      const { FS, path } = await filePath(key)
      raw = (await FS.getInfoAsync(path)).exists ? await FS.readAsStringAsync(path) : null
    }
    if (raw == null) return null
    const value = JSON.parse(raw) as T
    memo.set(key, value)
    return value
  } catch {
    return null
  }
}

export async function writeCache(key: string, value: unknown) {
  memo.set(key, value)
  try {
    const raw = JSON.stringify(value)
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(`offline:${key}`, raw)
      return
    }
    const { FS, dir, path } = await filePath(key)
    if (!(await FS.getInfoAsync(dir)).exists) {
      await FS.makeDirectoryAsync(dir, { intermediates: true })
    }
    await FS.writeAsStringAsync(path, raw)
  } catch (e) {
    // Не записалось (переполнен localStorage) — в памяти копия есть,
    // до перезапуска приложения работать можно
    console.warn('[offline] writeCache failed:', key, e)
  }
}

// Запрос со страховкой: удалось — обновили копию, нет связи — отдали копию
export async function cachedFetch<T>(key: string, fetch: () => Promise<T>): Promise<T> {
  try {
    const data = await fetch()
    setOnline(true)
    void writeCache(key, data)
    return data
  } catch (e) {
    if (!isOfflineError(e)) throw e
    setOnline(false)
    const cached = await readCache<T>(key)
    if (cached == null) throw e
    return cached
  }
}

type CachedSession = { items: RawItem[]; status: string } & Record<string, unknown>

export const sessionKey = (id: number) => `session-${id}`

export async function patchSessionItems(id: number, fn: (items: RawItem[]) => RawItem[]) {
  const s = await readCache<CachedSession>(sessionKey(id))
  if (!s) return
  await writeCache(sessionKey(id), { ...s, items: fn(s.items ?? []) })
}

// ── Состояние для экранов ────────────────────────────────────────────────────

export type OfflineState = {
  online:  boolean
  syncing: boolean
  queued:  number       // операций текущего пользователя в очереди
  failed:  FailedOp[]   // сервер отказал — показываем, не повторяем
}

let state: OfflineState = { online: true, syncing: false, queued: 0, failed: [] }
const listeners = new Set<() => void>()

const setState = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export const getOfflineState = () => state
export const useOffline = () => useSyncExternalStore(subscribe, getOfflineState, getOfflineState)

export const setOnline = (online: boolean) => {
  if (state.online !== online) setState({ online })
}

// ── Очередь ──────────────────────────────────────────────────────────────────
// Операции помечены логином: сервер пишет в акт того, чей токен, — поэтому
// чужие сканы (кто-то вышел, не дождавшись связи) ждут входа своего автора.

const OUTBOX_KEY = 'offlineOutbox'
const FAILED_KEY = 'offlineFailed'

let outbox: Op[] = []
let user = ''

const mine = () => outbox.filter(o => o.user === user)

const persist = async () => {
  setState({ queued: mine().length })
  await AsyncStorage.multiSet([
    [OUTBOX_KEY, JSON.stringify(outbox)],
    [FAILED_KEY, JSON.stringify(state.failed)],
  ])
}

// Вызвать один раз при старте в _layout.tsx (после initApiHost)
export async function initOffline() {
  const [[, o], [, f], [, u]] = await AsyncStorage.multiGet([OUTBOX_KEY, FAILED_KEY, 'authUsername'])
  outbox = o ? JSON.parse(o) : []
  user = u ?? ''
  setState({ queued: mine().length, failed: f ? JSON.parse(f) : [] })
}

// После входа — очередь этого логина снова «моя»
export const setOfflineUser = (username: string) => {
  user = username
  setState({ queued: mine().length })
}

export const offlineUser = () => user

export const pendingOps = (sessionId: number) =>
  outbox.filter(o => o.user === user && o.sessionId === sessionId)

export const hasPending = (sessionId: number) => pendingOps(sessionId).length > 0

let seq = 0

// Op без id и логина — их проставляет очередь
type NewOp = Op extends infer O ? (O extends Op ? Omit<O, 'id' | 'user'> : never) : never

export async function enqueue(op: NewOp) {
  outbox = [...outbox, { ...op, id: `${Date.now()}-${++seq}`, user } as Op]
  await persist()
  void syncNow()
}

// Очередь целиком заменить (отмена скана, который ещё не ушёл)
export async function replaceMine(sessionId: number, ops: Op[]) {
  outbox = [...outbox.filter(o => o.user !== user || o.sessionId !== sessionId), ...ops]
  await persist()
}

export async function dismissFailed() {
  setState({ failed: [] })
  await persist()
}

// ── Досылка ──────────────────────────────────────────────────────────────────

class LocalError extends Error {}

const errorText = (e: unknown) => {
  if (e instanceof LocalError) return e.message
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as { message?: string | string[]; data?: { error?: string } } | undefined
    const msg = Array.isArray(d?.message) ? d.message.join(', ') : d?.message
    return d?.data?.error || msg || `Сервер ответил ${e.response?.status}`
  }
  return String(e)
}

// id позиции на сервере: у скана не из акта он появится только после досылки
async function resolveItemId(op: Extract<Op, { itemId: number | null }>) {
  if (op.itemId != null && op.itemId > 0) return op.itemId
  const s = await readCache<CachedSession>(sessionKey(op.sessionId))
  const it = s && findByCode(s.items ?? [], op.code)
  if (!it || it.id < 0) throw new LocalError(`Код ${op.code}: скан не прошёл — изменять нечего`)
  return it.id
}

async function send(op: Op) {
  const base = `/inventory-sessions/${op.sessionId}`
  if (op.kind === 'scan') {
    const res = await api.post(
      `${base}/scan`,
      { barcode: op.code, invNumber: op.code, scannedAt: op.at },
      { timeout: SEND_TIMEOUT },
    )
    const item = res.data.data.item as RawItem
    await patchSessionItems(op.sessionId, items => upsertItem(items, item))
    return
  }
  const itemId = await resolveItemId(op)
  if (op.kind === 'update') {
    const res = await api.patch(`${base}/items/${itemId}`, op.patch, { timeout: SEND_TIMEOUT })
    await patchSessionItems(op.sessionId, items => upsertItem(items, res.data.data as RawItem))
    return
  }
  try {
    const res = await api.post(`${base}/items/${itemId}/unscan`, undefined, { timeout: SEND_TIMEOUT })
    const d = res.data.data as { deleted: boolean; item?: RawItem }
    await patchSessionItems(op.sessionId, items =>
      d.deleted || !d.item ? removeItem(items, itemId) : upsertItem(items, d.item))
  } catch (e) {
    // Излишек уже удалён (прошлая досылка дошла, а ответ — нет)
    if (!(axios.isAxiosError(e) && e.response?.status === 404)) throw e
    await patchSessionItems(op.sessionId, items => removeItem(items, itemId))
  }
}

async function runSync() {
  if (!hasTokens() || !mine().length) return
  setState({ syncing: true })
  try {
    for (let op = mine()[0]; op; op = mine()[0]) {
      try {
        await send(op)
      } catch (e) {
        if (isOfflineError(e)) { setOnline(false); return }
        // 401: interceptor уже попробовал refresh и увёл на вход — продолжим после него
        if (axios.isAxiosError(e) && e.response?.status === 401) return
        setState({ failed: [...state.failed, { ...op, error: errorText(e), failedAt: new Date().toISOString() }] })
      }
      outbox = outbox.filter(o => o.id !== op.id)
      await persist()
      setOnline(true)
    }
  } finally {
    setState({ syncing: false })
  }
}

let syncing: Promise<void> | null = null
export const syncNow = () => (syncing ??= runSync().finally(() => { syncing = null }))

// Связь вернулась? Любой ответ сервера (кроме «бэкенд запускается») — да.
// Публичный эндпоинт — тот же, что у «Проверки связи» в настройках.
async function checkOnline() {
  try {
    await axios.get(`${getApiBase()}/info-tablo/houses`, {
      timeout: SEND_TIMEOUT,
      validateStatus: s => s < 502,
    })
    setOnline(true)
  } catch {
    setOnline(false)
  }
}

// Фоновая досылка — один раз в _layout.tsx: при старте, при возврате
// в приложение и каждые 15 секунд, пока есть очередь или нет связи
export function useAutoSync() {
  useEffect(() => {
    const tick = () => {
      if (state.queued > 0) void syncNow()
      else if (!state.online) void checkOnline()
    }
    tick()
    const timer = setInterval(tick, 15000)
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick() })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [])
}
