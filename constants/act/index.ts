// Модуль акта в приложении: сборка из продовых адаптеров и хуки для экранов.
// Само поведение — acts.ts, термины — CONTEXT.md.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { account } from '../account'
import { localStore } from '../localStore'
import { type Store, createActs } from './acts'
import { httpServer } from './http'

export type {
  Act, ActItem, ActStatus, ActSummary, ActView, FailedOp, ItemStatus, OpPatch, ScanOutcome, SyncState,
} from './acts'

// Очередь маленькая и живёт в AsyncStorage (как в первой версии оффлайна),
// копии актов большие — файлами (localStore)
const QUEUE_KEYS = new Set(['offlineOutbox', 'offlineFailed'])
const store: Store = {
  get: key => (QUEUE_KEYS.has(key) ? AsyncStorage.getItem(key) : localStore.get(key)),
  set: (key, value) => (QUEUE_KEYS.has(key) ? AsyncStorage.setItem(key, value) : localStore.set(key, value)),
}

export const acts = createActs({
  server: httpServer,
  store,
  // Владелец очереди — логин, под которым вошли. Без входа очередь ничья
  // и не досылается: сервер всё равно не примет
  currentUser: () => account.user()?.login ?? '',
})

/** При старте приложения — после account.init() */
export async function initActs() {
  await acts.init()
  // Вошли под другим логином или снова после выхода — его очередь снова «своя»
  let owner = account.user()?.login ?? ''
  account.subscribe(() => {
    const login = account.user()?.login ?? ''
    if (login && login !== owner) void acts.init().then(() => acts.sync.tick())
    owner = login
  })
}

/**
 * Акт на экране: позиции (view) и действия (act.scan / relocate / cancel).
 * live — обновлять с сервера каждые 5 секунд (детали акта, пока экран виден).
 */
export function useAct(actId: number, { live = false }: { live?: boolean } = {}) {
  const act = acts.open(actId)
  const view = useSyncExternalStore(act.subscribe, act.view, act.view)
  const [error, setError] = useState<string | null>(null)

  // Без сети запрос ждёт таймаут дольше интервала обновления — не копим их
  const inFlight = useRef(false)
  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await act.refresh()
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      inFlight.current = false
    }
  }, [act])

  useEffect(() => {
    void refresh()
    if (!live) return
    const timer = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(timer)
  }, [refresh, live])

  return { act, view, error, refresh }
}

/** Состояние досылки — для плашки «Нет связи · N операций» */
export const useSyncState = () =>
  useSyncExternalStore(acts.sync.subscribe, acts.sync.state, acts.sync.state)

/**
 * Фоновая досылка — один раз в _layout.tsx: при старте, при возврате
 * в приложение и каждые 15 секунд (есть очередь — шлём, нет связи — проверяем)
 */
export function useAutoSync() {
  useEffect(() => {
    const tick = () => { void acts.sync.tick() }
    tick()
    const timer = setInterval(tick, 15000)
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick() })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [])
}
