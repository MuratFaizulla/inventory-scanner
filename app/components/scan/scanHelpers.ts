// components/scan/scanHelpers.ts

import { Colors } from '../../../constants/colors'
import type { ScanStatus } from './types'

export const statusColor = (s: ScanStatus) => {
  if (s === 'FOUND')     return Colors.accent2
  if (s === 'MISPLACED') return Colors.warn
  if (s === 'ALREADY')   return '#60a5fa'
  return Colors.danger
}

export const statusBg = (s: ScanStatus) => {
  if (s === 'FOUND')     return '#064e3b33'
  if (s === 'MISPLACED') return '#451a0333'
  if (s === 'ALREADY')   return '#1e3a5f33'
  return '#450a0a33'
}

export const statusEmoji = (s: ScanStatus) => {
  if (s === 'FOUND')     return '✅'
  if (s === 'MISPLACED') return '⚠️'
  if (s === 'ALREADY')   return '🔄'
  return '❌'
}

export const statusLabel = (s: ScanStatus) => {
  if (s === 'FOUND')     return 'Найден'
  if (s === 'MISPLACED') return 'Не на месте'
  if (s === 'ALREADY')   return 'Уже отсканирован'
  return 'Не найден'
}