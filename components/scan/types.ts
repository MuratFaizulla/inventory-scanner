// components/scan/types.ts

import type { ActItem } from '../../constants/act'

// OFFLINE_UNKNOWN — без сети, и кода нет в копии акта: решит сервер при отправке
export type ScanStatus = 'FOUND' | 'MISPLACED' | 'NOT_FOUND' | 'ALREADY' | 'SURPLUS' | 'OFFLINE_UNKNOWN'

export type ScanResult = {
  status:   ScanStatus
  // Позиция акта; у «уже отсканирован» — с данными первого скана
  item?:    ActItem
  message?: string
  queued?:  boolean   // скан пока на телефоне — уйдёт, когда будет связь
}

export type HistoryItem = {
  id:      string
  barcode: string
  status:  ScanStatus
  name:    string
  time:    string
}

export type Location = {
  id:   number
  name: string
}

export type Employee = {
  id:       number
  fullName: string
}
