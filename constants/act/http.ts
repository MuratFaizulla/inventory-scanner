// Адаптер сервера для модуля акта: бэкенд по HTTP (modules/inventory-session).
// Переводит ответы axios в язык модуля: нет связи → OfflineError, вход не
// продлился → AuthError, отказ сервера → ServerError с текстом для человека.
import axios from 'axios'
import api, { getApiBase, isOfflineError, serverMessage } from '../api'
import {
  type ActDetail, type ActServer, type ActSummary, type OpPatch, type RawItem, type ServerScan,
  AuthError, OfflineError, ServerError,
} from './acts'

// Сколько ждать ответа, прежде чем считать, что связи нет: при слабом Wi-Fi
// запрос висит минуту — сканировать столько никто не будет
const SEND_TIMEOUT = 6000
const READ_TIMEOUT = 10000

async function call<T>(request: () => Promise<{ data: { data: T } }>): Promise<T> {
  try {
    return (await request()).data.data
  } catch (e) {
    if (isOfflineError(e)) throw new OfflineError(serverMessage(e))
    // 401 доходит сюда, только если interceptor не смог продлить вход
    if (axios.isAxiosError(e) && e.response?.status === 401) throw new AuthError(serverMessage(e))
    if (axios.isAxiosError(e) && e.response) throw new ServerError(e.response.status, serverMessage(e))
    throw e
  }
}

const base = (actId: number) => `/inventory-sessions/${actId}`

export const httpServer: ActServer = {
  list: () =>
    call<ActSummary[]>(() => api.get('/inventory-sessions', { timeout: READ_TIMEOUT }))
      .then(list => list ?? []),

  get: actId => call<ActDetail>(() => api.get(base(actId), { timeout: READ_TIMEOUT })),

  // scannedAt — только у скана из очереди; без него бэкенд старой версии
  // (до scan-time.ts) принимает запрос как раньше
  scan: (actId, code, scannedAt) =>
    call<ServerScan>(() => api.post(
      `${base(actId)}/scan`,
      { barcode: code, invNumber: code, ...(scannedAt && { scannedAt }) },
      { timeout: SEND_TIMEOUT },
    )),

  update: (actId, itemId, patch: OpPatch) =>
    call<RawItem>(() => api.patch(`${base(actId)}/items/${itemId}`, patch, { timeout: SEND_TIMEOUT })),

  unscan: (actId, itemId) =>
    call<{ deleted: boolean; item?: RawItem }>(() =>
      api.post(`${base(actId)}/items/${itemId}/unscan`, undefined, { timeout: SEND_TIMEOUT })),

  // Публичный эндпоинт — тот же, что у «Проверки связи» в настройках.
  // Любой ответ сервера, кроме «бэкенд запускается», — связь есть
  async ping() {
    try {
      await axios.get(`${getApiBase()}/info-tablo/houses`, {
        timeout: SEND_TIMEOUT,
        validateStatus: s => s < 502,
      })
    } catch (e) {
      throw new OfflineError(serverMessage(e))
    }
  },
}
