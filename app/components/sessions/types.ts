export interface InventorySession {
  id:        number
  name:      string
  status:    string
  startedAt: string
  location:  { name?: string } | string | null
}

export interface InventorySessionDetail {
  id:        number
  name:      string
  status:    string
  startedAt: string
  location:  string | null
  total:     number
  found:     number
  notFound:  number
  misplaced: number
  pending:   number
}

export interface CollectionSession {
  id:        number
  name:      string
  status:    'OPEN' | 'CLOSED'
  assetType: string | null
  deadline:  string | null
  createdBy: string | null
  _count:    { items: number }
}

export interface LookupResult {
  id:                  number
  name:                string
  inventoryNumber:     string
  barcode:             string | null
  assetType:           string
  assetFaType:         string | null
  factoryNumber:       string | null
  accountingAccount:   string | null
  bookValue:           number | null
  residualValue:       number | null
  depreciationPercent: number | null
  acceptanceDate:      string | null
  location:            { name: string } | null
  employee:            { fullName: string } | null
  responsiblePerson:   { fullName: string } | null
  organization:        { name: string } | null
  photoKey:            string | null
}

export type Tab = 'inventory' | 'collection' | 'lookup'
