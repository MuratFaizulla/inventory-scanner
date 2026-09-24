// node --test constants/offlineCore.test.mjs
// (Node >= 22.18 сам снимает типы с .ts — сборка не нужна)
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyOp, localId, predictScan, replay, upsertItem, withoutQueuedScan,
} from './offlineCore.ts'

const AT = '2026-09-24T09:15:00.000Z'
const ME = 'murat'

const item = (over = {}) => ({
  id: 7,
  invNumber: '050000193',
  barcode: '4600000193',
  description: 'Тележка Folding Table Carts',
  expectedLocation: 'Каб. 214',
  actualLocation: null,
  correctedLocation: null,
  correctedEmployee: null,
  mol: 'Аубакирова А. А.',
  employee: 'Оканов Н. С.',
  status: 'pending',
  scannedAt: null,
  scannedBy: null,
  note: null,
  ...over,
})

let seq = 0
const op = (over) => ({ id: String(++seq), sessionId: 3, at: AT, user: ME, ...over })

describe('predictScan — что покажет телефон без сети', () => {
  it('непроверенная позиция по инв. номеру — «Найден», с моим временем', () => {
    const p = predictScan([item()], '050000193', AT, ME)
    assert.equal(p.status, 'found')
    assert.equal(p.alreadyScanned, false)
    assert.equal(p.item.scannedAt, AT)
    assert.equal(p.item.scannedBy, ME)
    assert.equal(p.item.queued, true)
  })

  it('по штрих-коду находит ту же позицию', () => {
    assert.equal(predictScan([item()], '4600000193', AT, ME).item.id, 7)
  })

  it('уже отсканированная — «уже», с данными первого скана', () => {
    const first = item({ status: 'found', scannedAt: '2026-09-23T08:00:00Z', scannedBy: 'aigul' })
    const p = predictScan([first], '050000193', AT, ME)
    assert.equal(p.alreadyScanned, true)
    assert.equal(p.item.scannedBy, 'aigul')
  })

  it('кода нет в копии акта — решит сервер, а на телефоне позиция под своим id', () => {
    const p = predictScan([item()], '999', AT, ME)
    assert.equal(p.status, 'unknown')
    assert.equal(p.item.id, localId('999'))
    assert.ok(p.item.id < 0)
  })
})

describe('replay — копия акта плюс очередь', () => {
  it('скан, потом перемещение в другой кабинет — «Не на месте» с примечанием', () => {
    const items = replay([item()], [
      op({ kind: 'scan', code: '050000193' }),
      op({ kind: 'update', code: '050000193', itemId: 7, patch: { location: 'Каб. 101' } }),
    ])
    assert.equal(items[0].status, 'misplaced')
    assert.equal(items[0].note, 'Перемещён в "Каб. 101"')
  })

  it('повторный скан того же кода в очереди ничего не меняет', () => {
    const once = replay([item()], [op({ kind: 'scan', code: '050000193' })])
    const twice = replay([item()], [
      op({ kind: 'scan', code: '050000193' }),
      op({ kind: 'scan', code: '4600000193', at: '2026-09-24T09:20:00.000Z' }),
    ])
    assert.deepEqual(twice, once)
  })

  it('скан кода не из акта добавляет позицию, отмена — убирает', () => {
    const scanned = replay([item()], [op({ kind: 'scan', code: '999' })])
    assert.equal(scanned.length, 2)
    const undone = applyOp(scanned, op({ kind: 'unscan', code: '999', itemId: null }))
    assert.equal(undone.length, 1)
  })

  it('отмена скана возвращает позицию в «Не проверено»', () => {
    const items = replay([item({ status: 'found', scannedAt: AT, scannedBy: ME })], [
      op({ kind: 'unscan', code: '050000193', itemId: 7 }),
    ])
    assert.equal(items[0].status, 'pending')
    assert.equal(items[0].scannedAt, null)
  })

  it('перемещение непроверенной позиции отмечает её проверенной, как сервер', () => {
    const items = replay([item()], [
      op({ kind: 'update', code: '050000193', itemId: 7, patch: { location: 'каб. 214 ' } }),
    ])
    assert.equal(items[0].status, 'found')
    assert.equal(items[0].scannedAt, AT)
  })
})

describe('withoutQueuedScan — отмена скана, который ещё не ушёл', () => {
  it('убирает скан и следующее за ним перемещение этой позиции, чужие не трогает', () => {
    const ops = [
      op({ kind: 'scan', code: '111' }),
      op({ kind: 'scan', code: '050000193' }),
      op({ kind: 'update', code: '050000193', itemId: 7, patch: { location: 'Каб. 101' } }),
      op({ kind: 'scan', code: '222' }),
    ]
    const view = replay([item()], ops)
    const left = withoutQueuedScan(ops, 3, view.find(i => i.id === 7))
    assert.deepEqual(left.map(o => o.code), ['111', '222'])
  })

  it('скан уже на сервере — null, отмену надо отправлять', () => {
    const sent = item({ status: 'found', scannedAt: AT })
    assert.equal(withoutQueuedScan([op({ kind: 'scan', code: '111' })], 3, sent), null)
  })

  it('скан того же кода в другом акте не трогает', () => {
    const ops = [op({ kind: 'scan', code: '050000193', sessionId: 4 })]
    assert.equal(withoutQueuedScan(ops, 3, item()), null)
  })
})

describe('upsertItem — ответ сервера в копию', () => {
  it('заменяет позицию по id, новую добавляет в конец', () => {
    const fresh = item({ status: 'found' })
    assert.equal(upsertItem([item()], fresh)[0].status, 'found')
    assert.equal(upsertItem([item()], item({ id: 8 })).length, 2)
  })
})
