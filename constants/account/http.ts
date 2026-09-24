// Адаптер сервера для учётной записи: /auth, /auth/refresh, /auth/logout.
// Голый axios, а не клиент api: 401 здесь — ответ «вход не принят»,
// а не повод обновлять токен
import axios from 'axios'
import { apiBaseFor } from '../api'
import type { AuthServer, Tokens } from './account'

const HEADERS = { 'x-client': 'mobile' }   // мобильному бэкенд отдаёт refresh-токен в теле

const tokensOf = (d: { access_token?: string; refresh_token?: string } | undefined): Tokens | null =>
  d?.access_token && d.refresh_token ? { access: d.access_token, refresh: d.refresh_token } : null

export const httpAuth: AuthServer = {
  async signIn(host, login, password) {
    // Вход проверяет AD — даём время; без ответа — «сервер не ответил вовремя»
    const res = await axios.post(`${apiBaseFor(host)}/auth`, { username: login, password }, { headers: HEADERS, timeout: 20000 })
    const d = res.data?.data
    const tokens = tokensOf(d)
    if (!tokens) throw new Error('Сервер не вернул токены — обновите бэкенд')
    return { ...tokens, name: d.user?.displayName || d.user?.username || login, role: d.user?.role ?? '' }
  },

  async refresh(host, refreshToken) {
    try {
      const res = await axios.post(`${apiBaseFor(host)}/auth/refresh`, { refresh_token: refreshToken }, { headers: HEADERS, timeout: 10000 })
      return tokensOf(res.data?.data)
    } catch (e) {
      // Сервер ответил: токен не годится (истёк, отозван, уже использован)
      if (axios.isAxiosError(e) && e.response && [400, 401, 403].includes(e.response.status)) return null
      throw e
    }
  },

  async signOut(host, refreshToken) {
    // Токен доступа не нужен: бэкенд отзывает refresh-токен из тела
    await axios.post(`${apiBaseFor(host)}/auth/logout`, { refresh_token: refreshToken }, { headers: HEADERS, timeout: 5000 })
  },
}
