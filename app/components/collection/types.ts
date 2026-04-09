export type ScanStatus = 'RETURNED' | 'DAMAGED' | 'LOST'
export type ScreenMode = 'camera' | 'manual' | 'result' | 'history'

export interface ScannedAsset {
  name:              string
  inventoryNumber:   string
  barcode:           string | null
  location:          { name: string } | null
  employee:          { fullName: string } | null
  responsiblePerson: { fullName: string } | null
}

export interface ScanResult {
  item:            { id: number; status: string }
  asset:           ScannedAsset
  alreadyScanned:  boolean
  previousStatus?: string
}

export interface SessionStats {
  total: number; returned: number; damaged: number; lost: number; pending: number
}

export interface HistoryEntry {
  id:     string
  name:   string
  inv:    string
  status: ScanStatus | 'ALREADY'
  time:   string
}

export interface PendingContext {
  employeeName:         string | null
  employeePending:      { name: string; inventoryNumber: string }[]
  locationName:         string | null
  locationPendingCount: number
}

export const STATUS_CFG = {
  RETURNED: { emoji: '✅', label: 'Принято',     color: '#4ade80', bg: '#052e16', border: '#16a34a' },
  DAMAGED:  { emoji: '⚠️', label: 'Повреждено',  color: '#facc15', bg: '#422006', border: '#ca8a04' },
  LOST:     { emoji: '🔴', label: 'Утеряно',     color: '#c084fc', bg: '#3b0764', border: '#9333ea' },
  ALREADY:  { emoji: '🔄', label: 'Уже отмечен', color: '#60a5fa', bg: '#0c1e3a', border: '#1e4a7a' },
} as const
