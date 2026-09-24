// npm test — модуль акта через его интерфейс.
// Сервер и хранилище — адаптеры в памяти; сервер повторяет правила бэкенда
// (inventory-session.service.ts), чтобы проверять телефон против них, а не
// против самого себя. Node >= 22.18 сам снимает типы с .ts — сборка не нужна.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createActs, OfflineError, ServerError } from './acts.ts'

const T0 = new Date('2026-09-24T09:15:00.000Z')
const SERVER_TIME = '2026-09-24T12:00:00.000Z'
const norm = v => (v ?? '').trim().toLowerCase()

const item = over => ({
  invNumber: null, barcode: null, description: null,
  expectedLocation: null, actualLocation: null,
  correctedLocation: null, correctedEmployee: null,
  mol: 'Аубакирова А. А.', employee: null,
  status: 'pending', scannedAt: null, scannedBy: null, note: null,
  ...over,
})

// Сервер в памяти: акт 3 идёт, в нём тележка (7) и монитор (8);
// в базе ещё есть принтер — его в акте нет (будет излишком)
function fakeServer() {
  const acts = {
    3: {
      id: 3, title: 'Каб. 214 и 101', status: 'in_progress', createdBy: 'murat',
      conductedBy: null, mol: null, employee: null, locationFilter: null, notes: null,
      createdAt: '2026-09-20T08:00:00Z', startedAt: '2026-09-20T08:00:00Z', completedAt: null,
      items: [
        item({ id: 7, invNumber: '050000193', barcode: '4600000193', description: 'Тележка', expectedLocation: 'Каб. 214' }),
        item({ id: 8, invNumber: '050000200', description: 'Монитор', expectedLocation: 'Каб. 101' }),
      ],
    },
  }
  const catalog = [
    { invNumber: '050000193', barcode: '4600000193', description: 'Тележка', location: 'Каб. 214' },
    { invNumber: '050000200', barcode: null, description: 'Монитор', location: 'Каб. 101' },
    { invNumber: '050000999', barcode: null, description: 'Принтер', location: 'Каб. 305' },
  ]
  const s = { online: true, calls: [], acts, nextId: 100 }
  const guard = (name, ...args) => {
    s.calls.push([name, ...args])
    if (!s.online) throw new OfflineError('нет связи')
  }
  const copy = x => structuredClone(x)
  const find = (actId, itemId) => {
    const it = acts[actId].items.find(i => i.id === itemId)
    if (!it) throw new ServerError(404, 'Позиция не найдена')
    return it
  }

  s.list = async () => {
    guard('list')
    return Object.values(acts).map(({ items: _, ...a }) => copy(a))
  }
  s.get = async actId => {
    guard('get', actId)
    return copy(acts[actId])
  }
  s.scan = async (actId, code, scannedAt) => {
    guard('scan', actId, code, scannedAt)
    const act = acts[actId]
    if (act.status !== 'in_progress') throw new ServerError(400, 'Сканировать можно только в запущенной сессии')
    const asset = catalog.find(a => a.invNumber === code || a.barcode === code)
    if (!asset) throw new ServerError(404, 'Актив не найден в базе')
    const at = scannedAt ?? SERVER_TIME
    const existing = act.items.find(i => i.invNumber === asset.invNumber)
    if (existing) {
      if (existing.scannedAt) return { status: existing.status, alreadyScanned: true, item: copy(existing) }
      existing.status = norm(asset.location) === norm(existing.expectedLocation) ? 'found' : 'misplaced'
      Object.assign(existing, { actualLocation: asset.location, scannedAt: at, scannedBy: 'murat' })
      return { status: existing.status, alreadyScanned: false, item: copy(existing) }
    }
    const surplus = item({
      id: s.nextId++, invNumber: asset.invNumber, description: asset.description,
      actualLocation: asset.location, status: 'surplus', scannedAt: at, scannedBy: 'murat',
    })
    act.items.push(surplus)
    return { status: 'surplus', alreadyScanned: false, item: copy(surplus) }
  }
  s.update = async (actId, itemId, patch) => {
    guard('update', actId, itemId, patch)
    const it = find(actId, itemId)
    if (patch.location !== undefined) it.correctedLocation = patch.location.trim() || null
    if (patch.employee !== undefined) it.correctedEmployee = patch.employee.trim() || null
    return copy(it)
  }
  s.unscan = async (actId, itemId) => {
    guard('unscan', actId, itemId)
    const act = acts[actId]
    const it = find(actId, itemId)
    if (it.status === 'surplus') {
      act.items = act.items.filter(i => i !== it)
      return { deleted: true }
    }
    Object.assign(it, { status: 'pending', actualLocation: null, scannedAt: null, scannedBy: null })
    return { deleted: false, item: copy(it) }
  }
  s.ping = async () => guard('ping')
  return s
}

function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial))
  return { map, get: async k => map.get(k) ?? null, set: async (k, v) => { map.set(k, v) } }
}

function setup({ store = memoryStore(), user = 'murat' } = {}) {
  const server = fakeServer()
  const clock = { t: T0 }
  const who = { user }
  const acts = createActs({ server, store, currentUser: () => who.user, now: () => clock.t })
  return { acts, server, store, clock, who }
}

// Фоновые обещания (досылка, сохранение актов из списка) — дождаться
const settle = () => new Promise(r => setTimeout(r, 0))
const scans = server => server.calls.filter(c => c[0] === 'scan')
const byId = (act, id) => act.view().items.find(i => i.id === id)

describe('скан с сетью', () => {
  it('позиция из акта — сразу на сервер, время ставит сервер', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    const r = await act.scan('4600000193')
    assert.equal(r.kind, 'found')
    assert.equal(r.queued, false)
    assert.equal(scans(server)[0][3], undefined)
    assert.equal(act.view().counts.found, 1)
  })

  it('кода нет в базе — «не найден» как результат, а не ошибка', async () => {
    const { acts } = setup()
    assert.deepEqual(await acts.open(3).scan('777'), { kind: 'not_found', code: '777' })
  })
})

describe('скан без сети', () => {
  it('результат по копии акта, скан в очереди, в акт уходит время скана', async () => {
    const { acts, server, clock } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    const r = await act.scan('4600000193')
    assert.equal(r.kind, 'found')
    assert.equal(r.queued, true)
    assert.equal(byId(act, 7).queued, true)
    assert.deepEqual(
      { online: acts.sync.state().online, queued: acts.sync.state().queued },
      { online: false, queued: 1 },
    )

    clock.t = new Date('2026-09-24T10:30:00.000Z')
    server.online = true
    await acts.sync.tick()

    assert.equal(server.acts[3].items[0].scannedAt, T0.toISOString())
    assert.equal(acts.sync.state().queued, 0)
    assert.equal(byId(act, 7).queued, false)
  })

  it('кода нет в копии — «проверим при отправке»; сервер решает: излишек', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    assert.deepEqual(await act.scan('050000999'), { kind: 'unknown', code: '050000999' })
    server.online = true
    await acts.sync.tick()

    const surplus = act.view().items.find(i => i.invNumber === '050000999')
    assert.equal(surplus.status, 'surplus')
    assert.ok(surplus.id > 0)
    assert.equal(act.view().counts.surplus, 1)
  })

  it('перемещение позиции, которой ещё нет на сервере, уходит после её скана', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    await act.scan('050000999')
    const local = act.view().items.find(i => i.invNumber === '050000999')
    assert.ok(local.id < 0)
    assert.deepEqual(await act.relocate(local.id, { location: 'Каб. 305а' }), { queued: true })

    server.online = true
    await acts.sync.tick()
    const surplus = server.acts[3].items.find(i => i.invNumber === '050000999')
    assert.equal(surplus.correctedLocation, 'Каб. 305а')
    // После связи: скан, затем перемещение — уже с id, который выдал сервер
    const [scan, update] = server.calls.slice(-2)
    assert.deepEqual([scan[0], update[0], update[2]], ['scan', 'update', surplus.id])
  })

  it('отмена ещё не отправленного скана — сервер о нём не узнаёт', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    await act.scan('4600000193')
    await act.cancel(7)
    assert.equal(byId(act, 7).status, 'pending')
    assert.equal(acts.sync.state().queued, 0)

    server.online = true
    await acts.sync.tick()
    assert.equal(server.acts[3].items[0].scannedAt, null)
  })

  it('повторный скан того же ОС — «уже отсканирован», второй операции нет', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    await act.scan('050000193')
    const again = await act.scan('4600000193')
    assert.equal(again.kind, 'already')
    assert.equal(acts.sync.state().queued, 1)
  })

  it('перемещение в тот же кабинет с другим регистром — «найдено», как на сервере', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    await act.relocate(8, { location: 'каб. 101 ' })
    assert.equal(byId(act, 8).status, 'found')
    assert.equal(byId(act, 8).scannedAt, T0.toISOString())
  })

  it('сервер не принял скан (акт завершили) — в «не принято», очередь идёт дальше', async () => {
    const { acts, server } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false

    await act.scan('4600000193')
    await act.relocate(8, { employee: 'Оканов Н. С.' })
    server.acts[3].status = 'completed'
    server.online = true
    await acts.sync.tick()

    const { queued, failed } = acts.sync.state()
    assert.equal(queued, 0)
    assert.equal(failed.length, 1)
    assert.equal(failed[0].kind, 'scan')
    assert.match(failed[0].error, /запущенной сессии/)
    assert.equal(server.acts[3].items[1].correctedEmployee, 'Оканов Н. С.')
  })

  it('без связи и без копии акта — понятная ошибка', async () => {
    const { acts, server } = setup()
    server.online = false
    await assert.rejects(acts.open(3).scan('4600000193'), /не сохранён на телефоне/)
  })
})

describe('список актов', () => {
  it('с сетью сохраняет запущенные акты: без сети в них сразу можно сканировать', async () => {
    const { acts, server } = setup()
    const list = await acts.list()
    assert.deepEqual(list.map(a => a.id), [3])
    await settle()

    server.online = false
    assert.deepEqual((await acts.list()).map(a => a.id), [3])
    const r = await acts.open(3).scan('050000200')
    assert.equal(r.kind, 'found')
    assert.equal(r.queued, true)
  })
})

describe('очередь и логин', () => {
  it('очередь принадлежит логину: чужие сканы ждут входа своего автора', async () => {
    const { acts, server, who } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false
    await act.scan('4600000193')

    who.user = 'aigul'
    await acts.init()
    server.online = true
    await acts.sync.tick()
    assert.equal(acts.sync.state().queued, 0)
    assert.equal(server.acts[3].items[0].scannedAt, null)

    who.user = 'murat'
    await acts.init()
    await acts.sync.tick()
    assert.equal(server.acts[3].items[0].scannedAt, T0.toISOString())
  })

  it('никто не вошёл — досылки нет', async () => {
    const { acts, server, who } = setup()
    const act = acts.open(3)
    await act.refresh()
    server.online = false
    await act.scan('4600000193')

    who.user = ''
    server.online = true
    await acts.sync.tick()
    assert.equal(server.acts[3].items[0].scannedAt, null)
  })

  it('очередь первой версии оффлайна (с sessionId) подхватывается', async () => {
    const at = '2026-09-24T08:00:00.000Z'
    const store = memoryStore({
      offlineOutbox: JSON.stringify([{ id: '1', kind: 'scan', sessionId: 3, code: '050000193', at, user: 'murat' }]),
      'session-3': JSON.stringify(fakeServer().acts[3]),
    })
    const { acts, server } = setup({ store })
    await acts.init()
    assert.equal(acts.sync.state().queued, 1)

    await acts.sync.tick()
    assert.equal(scans(server)[0][3], at)
    assert.equal(server.acts[3].items[0].scannedAt, at)
  })
})
