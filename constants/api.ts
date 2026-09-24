// HTTP-клиент бэкенда. Кто вошёл, какой у него токен и на каком он сервере —
// дело учётной записи (constants/account): она подключается через setAuth
// и задаёт адрес через setApiHost. Здесь — только запросы.
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { Platform } from 'react-native'

// Веб-версия по HTTPS (nginx раздаёт /scanner/ и проксирует /api/ на бэкенд):
// API всегда там же, где страница. Адрес сервера вводить незачем, а запрос
// на http://… со страницы https браузер всё равно заблокирует (mixed content)
export const sameOrigin =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location.protocol === 'https:'

// Адрес сервера в памяти — синхронный доступ из interceptor'а
let cachedHost = ''
export const setApiHost = (host: string) => { cachedHost = host.trim() }

const hostBaseFor = (host: string) => (sameOrigin ? window.location.origin : `http://${host}`)
export const apiBaseFor = (host: string) => `${hostBaseFor(host)}/api`

// База без /api — для относительных URL (фото: /api/inventory/type-photo?...)
export const getHostBase = () => hostBaseFor(cachedHost)
export const getApiBase = () => apiBaseFor(cachedHost)

export interface Auth {
  token(): string
  /** true — токен обновлён; false — вход истёк; исключение — нет связи */
  refresh(): Promise<boolean>
}
let auth: Auth = { token: () => '', refresh: async () => false }
export const setAuth = (a: Auth) => { auth = a }

const api = axios.create()

// Синхронный interceptor — никакого async, всё из памяти
api.interceptors.request.use(config => {
  config.baseURL = getApiBase()
  config.headers['x-client'] = 'mobile'
  const token = auth.token()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 → обновить токен (все параллельные 401 ждут один запрос) → повтор.
// false — вход истёк: учётная запись его закончила, _layout ведёт на экран входа.
// Без связи refresh бросает сам — вход цел, запрос считается «нет связи»
api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || !original || original._retry) {
      throw error
    }
    if (!(await auth.refresh())) throw error
    original._retry = true
    original.headers.Authorization = `Bearer ${auth.token()}`
    return api.request(original)
  },
)

export default api
