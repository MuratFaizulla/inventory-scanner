// components/scan/types.ts

// OFFLINE_UNKNOWN — без сети, и кода нет в копии акта: решит сервер при отправке
export type ScanStatus = 'FOUND' | 'MISPLACED' | 'NOT_FOUND' | 'ALREADY' | 'SURPLUS' | 'OFFLINE_UNKNOWN'

export type ScannedAsset = {
  id:                number
  itemId:            number
  inventoryNumber:   string
  name:              string
  barcode:           string | null
  location:          string
  responsiblePerson: string
  employee:          string
}

export type PreviousScan = {
  scannedAt: string | null
  scannedBy: string | null
  note:      string | null
}

export type ScanResult = {
  status:           ScanStatus
  asset?:           ScannedAsset
  expectedLocation?: string
  actualLocation?:  string
  message?:         string
  previousScan?:    PreviousScan
  queued?:          boolean   // скан пока на телефоне — уйдёт, когда будет связь
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