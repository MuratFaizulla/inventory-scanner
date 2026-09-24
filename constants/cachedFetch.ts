// Запрос со страховкой для справочников (кабинеты, сотрудники): удалось —
// обновили копию на телефоне, нет связи — отдали копию. Акты живут в своём
// модуле (constants/act), здесь — только то, что без сети нужно лишь читать.
import { isOfflineError } from './errorText'
import { localStore } from './localStore'

const memo = new Map<string, unknown>()

export async function cachedFetch<T>(key: string, fetch: () => Promise<T>): Promise<T> {
  try {
    const data = await fetch()
    memo.set(key, data)
    localStore.set(key, JSON.stringify(data)).catch(() => {})
    return data
  } catch (e) {
    if (!isOfflineError(e)) throw e
    if (memo.has(key)) return memo.get(key) as T
    const raw = await localStore.get(key).catch(() => null)
    if (raw == null) throw e
    const data = JSON.parse(raw) as T
    memo.set(key, data)
    return data
  }
}
