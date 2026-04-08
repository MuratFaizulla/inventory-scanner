// components/scan/types.ts

export type ScanStatus = 'FOUND' | 'MISPLACED' | 'NOT_FOUND' | 'ALREADY'

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