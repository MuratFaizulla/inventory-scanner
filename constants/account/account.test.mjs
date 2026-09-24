// Учётная запись через её интерфейс: сервер — в памяти по правилам бэкенда
// (/auth, одноразовый refresh-токен, /auth/logout), хранилище — Map.
// Запуск: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AxiosError } from 'axios'
import { errorText, isOfflineError } from '../errorText.ts'
import { createAccount } from './account.ts'

const HOST = '10.22.5.53:3000'

const noConnection = () => new AxiosError('Network Error', 'ERR_NETWORK', { headers: {} }, {})
const refused = (status, error) => new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST',
  { headers: {} }, {}, { status, statusText: '', headers: {}, config: { headers: {} }, data: { success: false, data: { error, statusCode: status } } })

function fakeServer() {
  const people = { ivanov: { password: 'secret', name: 'Иванов Иван', role: 'lead' } }
  const valid = new Set()      // refresh-токены, которые сервер ещё примет
  let n = 0
  const pair = () => { n++; valid.add(`r${n}`); return { access: `a${n}`, refresh: `r${n}` } }
  const srv = {
    online: true,
    calls: [],
    hold: null,                // промис, которого ждёт refresh — для гонок
    async signIn(host, login, password) {
      srv.calls.push(['signIn', host, login])
      if (!srv.online) throw noConnection()
      const p = people[login]
      if (!p || p.password !== password) throw refused(401, 'Неверный логин или пароль')
      return { ...pair(), name: p.name, role: p.role }
    },
    async refresh(host, token) {
      srv.calls.push(['refresh', host, token])
      if (srv.hold) await srv.hold
      if (!srv.online) throw noConnection()
      if (!valid.delete(token)) return null   // одноразовый: второй раз не примет
      return pair()
    },
    async signOut(host, token) {
      srv.calls.push(['signOut', host, token])
      if (!srv.online) throw noConnection()
      valid.delete(token)
    },
    count: kind => srv.calls.filter(c => c[0] === kind).length,
  }
  return srv
}

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get: async keys => Object.fromEntries(keys.map(k => [k, data.get(k) ?? ''])),
    set: async values => { for (const [k, v] of Object.entries(values)) v ? data.set(k, v) : data.delete(k) },
  }
}

async function start({ server = fakeServer(), store = memoryStore() } = {}) {
  const account = createAccount({ server, store, isOffline: isOfflineError })
  await account.init()
  return { account, server, store, restart: () => start({ server, store }) }
}

const signIn = (account, over = {}) =>
  account.signIn({ host: HOST, login: 'ivanov', password: 'secret', remember: false, ...over })

test('вход с сетью: кто вошёл и что подставить в следующий раз', async () => {
  const { account, restart } = await start()
  assert.equal(account.user(), null)
  assert.deepEqual(await signIn(account, { login: '  ivanov ' }), { offline: false })
  assert.deepEqual(account.user(), { login: 'ivanov', name: 'Иванов Иван', role: 'lead' })
  assert.equal(account.token(), 'a1')
  const again = await restart()
  assert.deepEqual(again.account.user(), { login: 'ivanov', name: 'Иванов Иван', role: 'lead' })
  assert.deepEqual(again.account.saved(), { host: HOST, login: 'ivanov', password: '', remember: false })
})

test('пароль запоминается только по просьбе; «забыть» стирает его и после перезапуска', async () => {
  const { account, restart } = await start()
  await signIn(account, { remember: true })
  assert.deepEqual(account.saved(), { host: HOST, login: 'ivanov', password: 'secret', remember: true })
  await account.forgetPassword()
  assert.deepEqual((await restart()).account.saved(), { host: HOST, login: 'ivanov', password: '', remember: false })
  assert.ok(account.user(), 'забыть пароль — не выход')
})

test('без связи пускает тот же логин с тем же паролем, пока вход не истёк', async () => {
  const first = await start()
  await signIn(first.account)
  const { account, server } = await first.restart()   // перезапуск приложения в подвале
  server.online = false
  assert.deepEqual(await signIn(account), { offline: true })
  assert.deepEqual(account.user(), { login: 'ivanov', name: 'Иванов Иван', role: 'lead' })
  assert.equal(account.token(), 'a1')
})

test('без связи не пускает: другой пароль, другой логин, после «Выйти»', async () => {
  const { account, server } = await start()
  await signIn(account)
  server.online = false
  await assert.rejects(signIn(account, { password: 'wrong' }), e => errorText(e) === 'Нет связи с сервером')
  await assert.rejects(signIn(account, { login: 'petrov' }), e => errorText(e) === 'Нет связи с сервером')
  await account.signOut()
  await assert.rejects(signIn(account), e => errorText(e) === 'Нет связи с сервером')
  assert.equal(account.user(), null)
})

test('неверный пароль при связи — текст сервера, прежний вход не тронут', async () => {
  const { account } = await start()
  await signIn(account)
  await assert.rejects(signIn(account, { password: 'wrong' }), e => errorText(e) === 'Неверный логин или пароль')
  assert.equal(account.token(), 'a1')
  assert.equal(account.user()?.login, 'ivanov')
})

test('«Выйти»: сервер отзывает токен; логин, адрес и пароль остаются для экрана входа', async () => {
  const { account, server, restart } = await start()
  await signIn(account, { remember: true })
  let heard = 0
  account.subscribe(() => heard++)
  await account.signOut()
  assert.deepEqual(server.calls.at(-1), ['signOut', HOST, 'r1'])
  assert.equal(account.user(), null)
  assert.equal(account.token(), '')
  assert.ok(heard > 0, 'подписчики узнали о выходе')
  const again = await restart()
  assert.equal(again.account.user(), null)
  assert.deepEqual(again.account.saved(), { host: HOST, login: 'ivanov', password: 'secret', remember: true })
  assert.equal(await again.account.refresh(), false, 'отозванным токеном вход не вернуть')
})

test('«Выйти» без связи — всё равно выходит', async () => {
  const { account, server } = await start()
  await signIn(account)
  server.online = false
  await account.signOut()
  assert.equal(account.user(), null)
})

test('вход истёк (refresh не принят) — конец входа, как по кнопке «Выйти»', async () => {
  const { account, server, store } = await start()
  await signIn(account)
  let heard = 0
  account.subscribe(() => heard++)
  assert.equal(await account.refresh(), true)       // r1 → r2
  store.data.set('refreshToken', 'r1')              // устаревший токен: сервер его уже не примет
  const stale = await start({ server, store })
  assert.equal(await stale.account.refresh(), false)
  assert.equal(stale.account.user(), null)
  assert.equal(store.data.get('scannerName'), undefined, 'имя и роль чистятся так же, как при выходе')
  assert.equal(store.data.get('authUsername'), 'ivanov', 'логин остаётся для экрана входа')
  assert.ok(heard > 0)
})

test('обрыв связи при обновлении токена не выкидывает из входа', async () => {
  const { account, server } = await start()
  await signIn(account)
  server.online = false
  await assert.rejects(account.refresh(), e => isOfflineError(e))
  assert.equal(account.user()?.login, 'ivanov')
  assert.equal(account.token(), 'a1')
  server.online = true
  assert.equal(await account.refresh(), true, 'связь вернулась — тот же refresh-токен годится')
})

test('параллельные 401 — один запрос refresh; новый токен переживает перезапуск', async () => {
  const { account, server, restart } = await start()
  await signIn(account)
  const results = await Promise.all([account.refresh(), account.refresh(), account.refresh()])
  assert.deepEqual(results, [true, true, true])
  assert.equal(server.count('refresh'), 1)
  assert.equal(account.token(), 'a2')
  assert.equal((await restart()).account.token(), 'a2')
})

test('ответ refresh, пришедший после «Выйти», вход не возвращает', async () => {
  const { account, server } = await start()
  await signIn(account)
  let release
  server.hold = new Promise(r => { release = r })
  const pending = account.refresh()
  await account.signOut()
  release()
  assert.equal(await pending, false)
  assert.equal(account.user(), null)
  assert.equal(account.token(), '')
})

test('смена сервера заканчивает вход; тот же адрес — ничего не меняет', async () => {
  const { account } = await start()
  await signIn(account)
  await account.changeServer(` ${HOST} `)
  assert.equal(account.user()?.login, 'ivanov')
  await account.changeServer('10.22.5.54:3000')
  assert.equal(account.user(), null)
  assert.equal(account.saved().host, '10.22.5.54:3000')
})

test('после обновления приложения вход сохраняется, и без связи тоже', async () => {
  // Так хранила вход версия до модуля учётной записи; отпечаток посчитан её кодом
  const store = memoryStore({
    apiHost: HOST, authUsername: 'ivanov', authRole: 'lead', scannerName: 'Иванов Иван',
    rememberMe: '1', savedPassword: 'secret', offlineVerifier: '7d1e8f00',
    accessToken: 'old-a', refreshToken: 'old-r',
  })
  const { account, server } = await start({ store })
  assert.deepEqual(account.user(), { login: 'ivanov', name: 'Иванов Иван', role: 'lead' })
  assert.equal(account.token(), 'old-a')
  assert.deepEqual(account.saved(), { host: HOST, login: 'ivanov', password: 'secret', remember: true })
  server.online = false
  assert.deepEqual(await signIn(account), { offline: true })
})

test('user() — один объект, пока вход тот же (для useSyncExternalStore)', async () => {
  const { account } = await start()
  await signIn(account)
  const u = account.user()
  await account.refresh()
  assert.equal(account.user(), u)
})
