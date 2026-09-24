// Правила акта — внутренности модуля акта (acts.ts), без сети и хранилища.
//
// Копия акта — последнее состояние с сервера, поверх неё — очередь
// неотправленных операций. Экран видит копию с применённой очередью; правила
// повторяют бэкенд (inventory-session.service.ts: scan / updateItem /
// unscanItem). Термины — CONTEXT.md.

// mapItem() из inventory-session.service.ts
export interface RawItem {
  id: number
  invNumber: string | null
  barcode: string | null
  description: string | null
  expectedLocation: string | null
  actualLocation: string | null
  correctedLocation: string | null
  correctedEmployee: string | null
  mol: string | null
  employee: string | null
  status: 'pending' | 'found' | 'not_found' | 'misplaced' | 'surplus'
  scannedAt: string | null
  scannedBy: string | null
  note: string | null
  // Локальная пометка: изменение ещё лежит в очереди телефона
  queued?: boolean
}

export type OpPatch = { location?: string; employee?: string }

type OpBase = { id: string; actId: number; code: string; at: string; user: string }

// code — инв. номер или штрих-код, по которому сервер найдёт позицию;
// itemId — null, пока позиция есть только на телефоне (скан не из акта)
export type Op =
  | (OpBase & { kind: 'scan' })
  | (OpBase & { kind: 'update'; itemId: number | null; patch: OpPatch })
  | (OpBase & { kind: 'unscan'; itemId: number | null })

export type FailedOp = Op & { error: string; failedAt: string }

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase()

export const matchesCode = (it: RawItem, code: string) =>
  it.invNumber === code || it.barcode === code

export const findByCode = (items: RawItem[], code: string) =>
  items.find(it => matchesCode(it, code))

// Код, по которому позицию найдёт сервер при досылке
export const itemCode = (it: RawItem) => it.invNumber || it.barcode || ''

// Скан кода, которого нет в копии акта, живёт на телефоне под отрицательным
// id — стабильным для одного и того же кода, чтобы экран мог на него ссылаться
export const localId = (code: string) => {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0
  return -(Math.abs(h) + 1)
}

// buildNote() из inventory-session.service.ts
const buildNote = (loc: string | null, emp: string | null) => {
  const parts: string[] = []
  if (loc?.trim()) parts.push(`Перемещён в "${loc.trim()}"`)
  if (emp?.trim()) parts.push(`Передан сотруднику "${emp.trim()}"`)
  return parts.length ? parts.join(', ') : null
}

export type Prediction = {
  // unknown — кода нет в копии акта: излишек или ОС нет в базе, решит сервер
  status: RawItem['status'] | 'unknown'
  alreadyScanned: boolean
  item: RawItem
}

// Что ответит сервер на скан — по копии акта
export function predictScan(items: RawItem[], code: string, at: string, user: string): Prediction {
  const it = findByCode(items, code)
  if (!it) {
    return {
      status: 'unknown',
      alreadyScanned: false,
      item: {
        id: localId(code),
        invNumber: code,
        barcode: null,
        description: null,
        expectedLocation: null,
        actualLocation: null,
        correctedLocation: null,
        correctedEmployee: null,
        mol: null,
        employee: null,
        status: 'surplus',
        scannedAt: at,
        scannedBy: user,
        note: 'Нет в акте — сервер проверит при отправке',
        queued: true,
      },
    }
  }
  if (it.scannedAt) return { status: it.status, alreadyScanned: true, item: it }
  // Сервер сверяет кабинет из 1С с ожидаемым; ожидаемый записан из того же
  // 1С при создании акта, так что без свежей синхронизации это «найден»
  return {
    status: 'found',
    alreadyScanned: false,
    item: {
      ...it,
      status: 'found',
      actualLocation: it.expectedLocation,
      scannedAt: at,
      scannedBy: user,
      queued: true,
    },
  }
}

const target = (items: RawItem[], op: { itemId: number | null; code: string }) =>
  items.find(i => op.itemId != null && i.id === op.itemId) ?? findByCode(items, op.code)

const replace = (items: RawItem[], from: RawItem, to: RawItem) =>
  items.map(i => (i === from ? to : i))

export function applyOp(items: RawItem[], op: Op): RawItem[] {
  if (op.kind === 'scan') {
    const p = predictScan(items, op.code, op.at, op.user)
    if (p.alreadyScanned) return items
    const old = findByCode(items, op.code)
    return old ? replace(items, old, p.item) : [...items, p.item]
  }

  const it = target(items, op)
  if (!it) return items

  if (op.kind === 'unscan') {
    if (it.status === 'surplus') return items.filter(i => i !== it)
    return replace(items, it, {
      ...it,
      status: 'pending',
      actualLocation: null,
      correctedLocation: null,
      correctedEmployee: null,
      scannedAt: null,
      scannedBy: null,
      note: null,
      queued: true,
    })
  }

  // update — перемещение: правила updateItem() бэкенда
  const next: RawItem = { ...it, queued: true }
  if (op.patch.location !== undefined) next.correctedLocation = op.patch.location.trim() || null
  if (op.patch.employee !== undefined) next.correctedEmployee = op.patch.employee.trim() || null
  next.note = buildNote(next.correctedLocation, next.correctedEmployee)
  if (next.status !== 'surplus' && (next.correctedLocation || next.scannedAt)) {
    const effLoc = next.correctedLocation ?? next.actualLocation
    next.status = norm(effLoc) === norm(next.expectedLocation) ? 'found' : 'misplaced'
    if (!next.scannedAt) {
      next.scannedAt = op.at
      next.scannedBy = op.user
    }
  }
  return replace(items, it, next)
}

export const replay = (items: RawItem[], ops: Op[]) => ops.reduce(applyOp, items)

// Отмена скана, который ещё не ушёл: убираем его и все следующие операции
// с той же позицией — серверу про них знать незачем. null — такого скана
// в очереди нет, отмену надо отправлять.
export function withoutQueuedScan(ops: Op[], actId: number, item: RawItem): Op[] | null {
  const idx = ops.findIndex(
    o => o.actId === actId && o.kind === 'scan' && matchesCode(item, o.code),
  )
  if (idx < 0) return null
  return ops.filter(
    (o, i) =>
      i < idx ||
      o.actId !== actId ||
      !(matchesCode(item, o.code) || (o.kind !== 'scan' && o.itemId === item.id)),
  )
}

// Ответ сервера после досылки — в копию акта
export const upsertItem = (items: RawItem[], item: RawItem) =>
  items.some(i => i.id === item.id)
    ? items.map(i => (i.id === item.id ? item : i))
    : [...items, item]

export const removeItem = (items: RawItem[], id: number) => items.filter(i => i.id !== id)

// ── Позиция акта — то, что видят экраны ─────────────────────────────────────

export type ItemStatus = RawItem['status']

export interface ActItem {
  id: number                        // < 0 — позиция пока есть только на телефоне
  invNumber: string | null
  barcode: string | null
  name: string | null
  status: ItemStatus
  location: string | null           // кабинет по акту с учётом перемещения
  expectedLocation: string | null   // где числится по 1С
  foundLocation: string | null      // где нашли при скане
  mol: string | null
  employee: string | null           // с учётом перемещения
  scannedAt: string | null
  scannedBy: string | null
  note: string | null
  queued: boolean                   // изменение ещё в очереди
}

export const toActItem = (r: RawItem): ActItem => ({
  id: r.id,
  invNumber: r.invNumber,
  barcode: r.barcode,
  name: r.description,
  status: r.status,
  // У излишка кабинета по акту нет — показываем, где нашли
  location: r.correctedLocation ?? r.expectedLocation ?? r.actualLocation,
  expectedLocation: r.expectedLocation,
  foundLocation: r.actualLocation,
  mol: r.mol,
  employee: r.correctedEmployee ?? r.employee,
  scannedAt: r.scannedAt,
  scannedBy: r.scannedBy,
  note: r.note,
  queued: !!r.queued,
})

export type ActCounts = Record<ItemStatus, number> & { total: number }

export const countItems = (items: { status: ItemStatus }[]): ActCounts => {
  const c: ActCounts = { pending: 0, found: 0, misplaced: 0, surplus: 0, not_found: 0, total: items.length }
  for (const it of items) c[it.status]++
  return c
}
