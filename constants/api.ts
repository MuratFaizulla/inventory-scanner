// // export const API_BASE = 'http://10.35.14.13:5173/api'
// export const API_BASE = 'http://10.216.209.118:8888/api'


import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

// Кэш хоста в памяти — заполняется при старте и при смене хоста
let cachedHost = ''

// Вызвать один раз при старте в _layout.tsx
export const initApiHost = async () => {
  const host = await AsyncStorage.getItem('apiHost')
  cachedHost = host?.trim() || ''
}

// Обновить хост (вызывается после сохранения в LoginScreen)
export const setApiHost = (host: string) => {
  cachedHost = host.trim()
}

// Синхронный геттер
export const getApiBase = () => `http://${cachedHost}/api`

const api = axios.create()

// Синхронный interceptor — никакого async, берёт из кэша
api.interceptors.request.use(config => {
  config.baseURL = getApiBase()
  return config
})

export default api