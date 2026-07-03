import AsyncStorage from '@react-native-async-storage/async-storage'
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Кэш хоста в памяти — заполняется при старте и при смене хоста
let cachedHost = ''

// Кэш токенов в памяти — синхронный доступ из interceptor'ов
let accessToken = ''
let refreshToken = ''

// Вызвать один раз при старте в _layout.tsx
export const initApiHost = async () => {
  const [host, access, refresh] = await AsyncStorage.multiGet([
    'apiHost', 'accessToken', 'refreshToken',
  ])
  cachedHost   = host[1]?.trim() || ''
  accessToken  = access[1] || ''
  refreshToken = refresh[1] || ''
}

// Обновить хост (вызывается после сохранения в LoginScreen)
export const setApiHost = (host: string) => {
  cachedHost = host.trim()
}

export const setTokens = async (access: string, refresh: string) => {
  accessToken  = access
  refreshToken = refresh
  await AsyncStorage.multiSet([
    ['accessToken',  access],
    ['refreshToken', refresh],
  ])
}

export const clearTokens = async () => {
  accessToken  = ''
  refreshToken = ''
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken'])
}

export const hasTokens = () => !!accessToken

export const getAccessToken = () => accessToken

// Синхронный геттер
export const getApiBase = () => `http://${cachedHost}/api`

// База без /api — для относительных URL (фото: /api/inventory/type-photo?...)
export const getHostBase = () => `http://${cachedHost}`

// Подписка на «сессия истекла» — router в _layout возвращает на логин
type ExpiredListener = () => void
let expiredListener: ExpiredListener | null = null
export const onAuthExpired = (fn: ExpiredListener) => { expiredListener = fn }

const api = axios.create()

// Синхронный interceptor — никакого async, берёт из кэша
api.interceptors.request.use(config => {
  config.baseURL = getApiBase()
  config.headers['x-client'] = 'mobile'
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// 401 → одна попытка refresh (token rotation) → повтор запроса
let refreshing: Promise<boolean> | null = null

const tryRefresh = async (): Promise<boolean> => {
  if (!refreshToken) return false
  try {
    const res = await axios.post(
      `${getApiBase()}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'x-client': 'mobile' } },
    )
    const d = res.data?.data
    if (!d?.access_token || !d?.refresh_token) return false
    await setTokens(d.access_token, d.refresh_token)
    return true
  } catch {
    return false
  }
}

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || !original || original._retry) {
      throw error
    }
    // Все параллельные 401 ждут один общий refresh
    refreshing ??= tryRefresh().finally(() => { refreshing = null })
    const ok = await refreshing
    if (!ok) {
      await clearTokens()
      expiredListener?.()
      throw error
    }
    original._retry = true
    original.headers.Authorization = `Bearer ${accessToken}`
    return api.request(original)
  },
)

// Вход: POST /api/auth — сохраняет токены, возвращает user
export const login = async (username: string, password: string) => {
  const res = await axios.post(
    `${getApiBase()}/auth`,
    { username, password },
    { headers: { 'x-client': 'mobile' } },
  )
  const d = res.data?.data
  if (!d?.access_token || !d?.refresh_token) {
    throw new Error('Сервер не вернул токены — обновите бэкенд')
  }
  await setTokens(d.access_token, d.refresh_token)
  return d.user as { username: string; displayName?: string; role: string }
}

export const logout = async () => {
  try {
    await api.post('/auth/logout', { refresh_token: refreshToken })
  } catch { /* сеть могла отвалиться — токены чистим в любом случае */ }
  await clearTokens()
}

export default api
