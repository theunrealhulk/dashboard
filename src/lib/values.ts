import type { CellValue } from '../types'

export function isBlank(value: CellValue): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '')
}

export function cellKey(value: CellValue): string | null {
  if (isBlank(value)) return null
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}
