// components/session/types.ts

import type { ActItem, ItemStatus } from '../../constants/act'

// Вкладки деталей акта; излишки показываем вместе с «не на месте»
export type TabType = 'FOUND' | 'NOT_FOUND' | 'MISPLACED' | 'PENDING'

export const tabOf = (status: ItemStatus): TabType =>
  status === 'found'     ? 'FOUND'
  : status === 'not_found' ? 'NOT_FOUND'
  : status === 'pending'   ? 'PENDING'
  : 'MISPLACED'

// Позиция акта — одна форма для всех экранов (constants/act)
export type Item = ActItem

export interface SessionDetail {
  id:        number
  name:      string
  status:    string
  location:  string
  found:     number
  notFound:  number
  misplaced: number
  pending:   number
  total:     number
  items:     Item[]
}

export interface Location {
  id:   number
  name: string
}

export interface Employee {
  id:       number
  fullName: string
}
