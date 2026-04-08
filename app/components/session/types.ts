// components/session/types.ts

export type TabType = 'FOUND' | 'NOT_FOUND' | 'MISPLACED' | 'PENDING'

export interface Asset {
  id:                number
  inventoryNumber:   string
  name:              string
  barcode:           string | null
  location:          { name: string }
  responsiblePerson: { fullName: string }
  employee:          { fullName: string } | null
}

export interface Item {
  id:        number
  status:    string
  note:      string | null
  scannedAt: string | null
  scannedBy: string | null
  asset:     Asset
}

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