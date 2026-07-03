// Типы раздела 1С — зеркалят backend/src/modules/onec-sync

export type AssetTable = 'fixed' | 'library'

export interface OnecAsset {
  id: number
  invNumber: string | null
  barcode: string | null
  description: string | null
  dateFix: string | null
  iin: string | null
  person: string | null
  location: string | null
  sn: string | null
  comment: string | null
  registrationDate: string | null
  accountablePersonIin: string | null
  accountablePerson: string | null
  locationCode: string | null
  account: string | null
  properties: string | null
  upgradeInfo: string | null
  photoPath: string | null
  syncedAt: string | null
}

export interface AssetsPage {
  items: OnecAsset[]
  total: number
  page: number
  totalPages: number
}

export interface SyncStatus {
  lastRun: string | null
  lastSuccess: string | null
  lastError: string | null
  running: boolean
  totalFixed: number
  totalLibrary: number
  changesAdded: number
  changesUpdated: number
  changesRemoved: number
}

export interface ChangedField {
  field: string
  oldValue: string
  newValue: string
}

export interface SyncChange {
  id: number
  syncedAt: string
  assetTable: AssetTable
  changeType: 'added' | 'updated' | 'removed'
  invNumber: string | null
  description: string | null
  changedFields: ChangedField[]
}

export interface ChangesResponse {
  syncedAt: string | null
  added: SyncChange[]
  updated: SyncChange[]
  removed: SyncChange[]
}

// Подписи полей — как в веб-версии (OnecSyncPage.jsx)
export const FIELD_LABELS: Record<string, string> = {
  person:            'Ответственный',
  location:          'Кабинет',
  accountablePerson: 'МОЛ',
  description:       'Наименование',
  dateFix:           'Дата принятия',
  sn:                'Серийный №',
}

// Тема раздела 1С — 1:1 с frontend/src/styles/variables.css (dark)
export const T = {
  bg:            '#020617',                  // --color-bg (slate-950)
  surface:       '#0f172a',                  // --color-surface
  elevated:      '#1e293b',                  // --color-elevated
  muted:         '#334155',                  // --color-muted
  border:        'rgba(51,65,85,0.5)',       // --color-border
  borderFaint:   'rgba(51,65,85,0.3)',       // --color-border-faint
  textPrimary:   '#f1f5f9',                  // --color-text-primary
  textSecondary: '#e2e8f0',                  // --color-text-secondary
  textMuted:     '#94a3b8',                  // --color-text-muted
  textFaint:     '#64748b',                  // --color-text-faint
  accent:        '#80C342',                  // --color-accent (NIS green)
  accentBg:      'rgba(128,195,66,0.08)',
  accentBorder:  'rgba(128,195,66,0.25)',
  emerald:       '#34d399',                  // --color-emerald-light
  emeraldBg:     'rgba(52,211,153,0.12)',
  warning:       '#f59e0b',                  // --color-warning
  warningBg:     'rgba(245,158,11,0.12)',
  danger:        '#f87171',                  // --color-danger-light
  dangerBg:      'rgba(239,68,68,0.1)',      // --color-danger-bg
  dangerBorder:  'rgba(239,68,68,0.3)',      // --color-danger-border
}

// Как fmt() в OnecSyncPage.jsx — с секундами
export const formatDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
