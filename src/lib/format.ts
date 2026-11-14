import type { CellValue, FileKind } from '../types'

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatInteger(value: number): string {
  return integerFormatter.format(value)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    value,
  )
}

export function formatCell(value: CellValue): string {
  if (value === null) return ''
  if (value instanceof Date) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value)
  }
  if (typeof value === 'number') return numberFormatter.format(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return value
}

export function formatForExport(value: CellValue): string {
  if (value === null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function fileKindFromName(name: string): FileKind | null {
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') return 'csv'
  if (extension === 'xlsx') return 'xlsx'
  if (extension === 'xls') return 'xls'
  return null
}

export function fileBaseName(name: string): string {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(0, index) : name
}

export function kindLabel(kind: FileKind): string {
  if (kind === 'csv') return 'CSV'
  if (kind === 'xls') return 'Excel 97–2003'
  if (kind === 'manual') return 'Manual'
  return 'Excel workbook'
}
