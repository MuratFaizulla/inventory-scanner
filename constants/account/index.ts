// Учётная запись в приложении: хранилище AsyncStorage, адаптер /auth,
// подключение к HTTP-клиенту и хук для экранов
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { setApiHost, setAuth } from '../api'
import { isOfflineError } from '../errorText'
import { createAccount, type Store } from './account'
import { httpAuth } from './http'

export type { AccountUser, Saved } from './account'

const store: Store = {
  get: async keys => Object.fromEntries((await AsyncStorage.multiGet(keys)).map(([k, v]) => [k, v ?? ''])),
  set: async values => {
    const entries = Object.entries(values)
    const gone = entries.filter(([, v]) => !v).map(([k]) => k)
    const kept = entries.filter(([, v]) => !!v)
    if (gone.length) await AsyncStorage.multiRemove(gone)
    if (kept.length) await AsyncStorage.multiSet(kept)
  },
}

export const account = createAccount({ server: httpAuth, store, isOffline: isOfflineError })

// HTTP-клиент берёт токен у учётной записи и её же просит обновить его по 401;
// адрес сервера — тоже её: при старте, входе и смене сервера
setAuth({ token: account.token, refresh: account.refresh })
account.subscribe(() => setApiHost(account.saved().host))

/** Кто вошёл; null — не вошли, вышли или вход истёк */
export const useAccountUser = () => useSyncExternalStore(account.subscribe, account.user, account.user)

// Подписи ролей — как на портале (TopNav, Sidebar)
const ROLE_LABELS: Record<string, string> = {
  admin:   'Администратор (IT)',
  lead:    'Директор',
  curator: 'Куратор',
  user:    'Пользователь',
}
export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role
