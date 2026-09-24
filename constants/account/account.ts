// Учётная запись: кто вошёл и на каком сервере, вход с сетью и без, выход.
// Единственный владелец ключей входа в хранилище — экраны и HTTP-клиент их
// не знают. Без React Native: сервер и хранилище подаются адаптерами, тесты
// гоняют модуль целиком (account.test.mjs).

export interface AccountUser {
  login: string   // логин AD, как его ввели; ему принадлежит очередь
  name:  string   // имя из AD — им подписываются сканы в акте
  role:  string   // admin | lead | curator | user
}

/** Что подставить на экране входа */
export interface Saved {
  host:     string
  login:    string
  password: string   // только если просили запомнить
  remember: boolean
}

export interface Tokens {
  access:  string
  refresh: string
}

export interface AuthServer {
  /** Вход; ошибку — как есть: «нет связи» отличает isOffline */
  signIn(host: string, login: string, password: string): Promise<Tokens & { name: string; role: string }>
  /** Новая пара токенов; null — сервер refresh-токен не принял, вход истёк */
  refresh(host: string, refreshToken: string): Promise<Tokens | null>
  /** Отозвать refresh-токен на сервере */
  signOut(host: string, refreshToken: string): Promise<void>
}

export interface Store {
  get(keys: string[]): Promise<Record<string, string>>   // нет ключа — ''
  set(values: Record<string, string>): Promise<void>     // '' — удалить
}

export interface Account {
  /** При старте приложения — до всего, что ходит на сервер */
  init(): Promise<void>
  /** Кто вошёл; null — не вошли, вышли или вход истёк. Один объект, пока вход тот же */
  user(): AccountUser | null
  saved(): Saved
  /**
   * Вход. Без связи пускает тот же логин с тем же паролем, пока вход не истёк:
   * работать можно с сохранёнными актами (offline: true)
   */
  signIn(input: { host: string; login: string; password: string; remember: boolean }): Promise<{ offline: boolean }>
  /** «Выйти»: без связи тоже выходит */
  signOut(): Promise<void>
  /** Токены старого сервера на новом не подойдут — вход заканчивается */
  changeServer(host: string): Promise<void>
  /** Забыть сохранённый пароль */
  forgetPassword(): Promise<void>
  subscribe(listener: () => void): () => void

  // Для HTTP-клиента
  token(): string
  /**
   * Обновить токен (параллельные вызовы ждут один запрос): true — обновлён,
   * false — вход истёк и закончен. Нет связи — исключение, вход не трогаем
   */
  refresh(): Promise<boolean>
}

// Ключи — как у прежних версий приложения: после обновления вход сохраняется
const KEYS = [
  'apiHost', 'authUsername', 'scannerName', 'authRole', 'rememberMe', 'savedPassword',
  'offlineVerifier', 'accessToken', 'refreshToken',
] as const
type State = Record<(typeof KEYS)[number], string>

// Конец входа — одинаковый для «Выйти», смены сервера и истёкшего входа.
// Логин, адрес и сохранённый пароль остаются — для экрана входа
const SIGNED_OUT: Partial<State> = { accessToken: '', refreshToken: '', scannerName: '', authRole: '' }

// Отпечаток пароля для входа без сети (FNV-1a): сверить, что вводят тот же
// пароль, можно, не храня его. Это замок на экране, не защита токенов —
// они и так лежат на телефоне
export const passVerifier = (login: string, password: string) => {
  let h = 0x811c9dc5
  for (const ch of `${login}\u0000${password}`) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function createAccount(deps: {
  server: AuthServer
  store: Store
  isOffline: (e: unknown) => boolean
}): Account {
  const { server, store, isOffline } = deps
  let s = Object.fromEntries(KEYS.map(k => [k, ''])) as State
  let user: AccountUser | null = null
  // Растёт при каждом входе и выходе: ответ refresh, пришедший после них, устарел
  let epoch = 0
  let refreshing: Promise<boolean> | null = null
  const listeners = new Set<() => void>()

  function derive() {
    const next = s.accessToken
      ? { login: s.authUsername, name: s.scannerName || s.authUsername, role: s.authRole }
      : null
    if (!next || !user || next.login !== user.login || next.name !== user.name || next.role !== user.role) {
      user = next
    }
  }

  async function update(patch: Partial<State>) {
    s = { ...s, ...patch }
    derive()
    await store.set(patch as Record<string, string>)
    for (const l of listeners) l()
  }

  function end(patch: Partial<State> = {}) {
    epoch++
    return update({ ...SIGNED_OUT, ...patch })
  }

  return {
    async init() {
      s = { ...s, ...(await store.get([...KEYS])) }
      derive()
      for (const l of listeners) l()
    },

    user: () => user,

    saved: () => ({
      host:     s.apiHost,
      login:    s.authUsername,
      password: s.rememberMe === '1' ? s.savedPassword : '',
      remember: s.rememberMe === '1',
    }),

    async signIn({ host, login, password, remember }) {
      host = host.trim()
      login = login.trim()
      let r
      try {
        r = await server.signIn(host, login, password)
      } catch (e) {
        if (
          isOffline(e) && s.accessToken &&
          login === s.authUsername && s.offlineVerifier === passVerifier(login, password)
        ) {
          return { offline: true }
        }
        throw e
      }
      epoch++
      await update({
        apiHost:         host,
        authUsername:    login,
        scannerName:     r.name,
        authRole:        r.role,
        rememberMe:      remember ? '1' : '',
        savedPassword:   remember ? password : '',
        offlineVerifier: passVerifier(login, password),
        accessToken:     r.access,
        refreshToken:    r.refresh,
      })
      return { offline: false }
    },

    async signOut() {
      // Сервер отзывает refresh-токен; без связи выходим всё равно
      if (s.refreshToken) await server.signOut(s.apiHost, s.refreshToken).catch(() => {})
      await end()
    },

    async changeServer(host) {
      host = host.trim()
      if (host === s.apiHost) return
      await end({ apiHost: host })
    },

    forgetPassword: () => update({ rememberMe: '', savedPassword: '' }),

    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    token: () => s.accessToken,

    refresh() {
      refreshing ??= (async () => {
        if (!s.refreshToken) {
          if (s.accessToken) await end()
          return false
        }
        const started = epoch
        // Нет связи или сбой сервера — исключение наружу, вход не трогаем
        const next = await server.refresh(s.apiHost, s.refreshToken)
        if (started !== epoch) return false
        if (!next) {
          await end()
          return false
        }
        await update({ accessToken: next.access, refreshToken: next.refresh })
        return true
      })().finally(() => { refreshing = null })
      return refreshing
    },
  }
}
