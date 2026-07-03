// Типы и хелперы модуля инвентаря — зеркалят backend/src/modules/inventory
import { getHostBase } from '../../constants/api'

// mapAsset() из inventory.service.ts
export interface InvAsset {
  id: number
  name: string | null
  inventoryNumber: string | null
  barcode: string | null
  location: { name: string } | null
  locationCode: string | null
  sn: string | null
  dateFix: string | null
  account: string | null
  properties: string | null
  upgradeInfo: string | null
  comment: string | null
  photoPath: string | null
  // /inventory/assets и type-assets добавляют:
  person?: string | null
  accountablePerson?: string | null
}

export interface AssetType {
  name: string
  total: number
  topLocation: string | null
  locationCount: number
  photoPath: string | null
}

export interface TypeDetail {
  name: string
  total: number
  locationCount: number
  byLocation: { location: string; count: number }[]
  assets: InvAsset[]
}

// photoPath приходит относительным (/api/inventory/type-photo?...) — делаем абсолютным
export const photoUri = (path: string | null | undefined): string | null =>
  path ? `${getHostBase()}${path}` : null

// assetMeta() из InventoryPage.jsx / AssetTypesPage.jsx — иконка и цвет по наименованию.
// Иконки MaterialCommunityIcons (в Feather нет laptop и мебели).
export interface AssetMeta {
  icon: string
  color: string
}

export function assetMeta(name: string | null | undefined): AssetMeta {
  const t = (name || '').toLowerCase()
  if (t.includes('ноутбук') || t.includes('laptop'))                     return { icon: 'laptop',            color: '#60a5fa' } // blue
  if (t.includes('компьютер') || t.includes('пк') || t.includes('пэвм')) return { icon: 'desktop-tower-monitor', color: '#a78bfa' } // violet
  if (t.includes('монитор'))                                             return { icon: 'monitor',           color: '#22d3ee' } // cyan
  if (t.includes('принтер') || t.includes('мфу'))                        return { icon: 'printer',           color: '#fb923c' } // orange
  if (t.includes('телефон') || t.includes('трубка'))                     return { icon: 'cellphone',         color: '#34d399' } // emerald
  if (t.includes('процессор') || t.includes('сервер'))                   return { icon: 'server',            color: '#f87171' } // red
  if (t.includes('диск') || t.includes('накопитель'))                    return { icon: 'harddisk',          color: '#facc15' } // yellow
  if (t.includes('wifi') || t.includes('роутер') || t.includes('коммут')) return { icon: 'wifi',             color: '#2dd4bf' } // teal
  if (t.includes('камер') || t.includes('видео'))                        return { icon: 'camera-outline',    color: '#f472b6' } // pink
  if (t.includes('стол') || t.includes('стул') || t.includes('шкаф') || t.includes('полк'))
    return { icon: 'table-furniture', color: '#fbbf24' } // amber
  return { icon: 'package-variant', color: '#94a3b8' } // slate
}
