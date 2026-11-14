import { max, mean, min } from 'd3'
import type { CellValue, ColumnStats, ColumnType } from '../types'
import { isBlank } from './values'

type PresentValue = string | number | boolean | Date

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function inferType(values: PresentValue[]): ColumnType {
  if (values.length === 0) return 'empty'
  if (values.every((value) => value instanceof Date)) return 'date'
  if (values.every(isNumeric)) return 'number'
  if (values.every((value) => typeof value === 'boolean')) return 'boolean'
  return 'text'
}

function uniqueCount(values: PresentValue[]): number {
  const seen = new Set<string>()
  for (const value of values) {
    seen.add(value instanceof Date ? value.toISOString() : String(value))
  }
  return seen.size
}

export function analyzeColumns(
  rows: Record<string, CellValue>[],
  columns: string[],
  declaredTypes?: Record<string, ColumnType>,
): ColumnStats[] {
  return columns.map((name) => {
    const present = rows
      .map((row) => row[name])
      .filter((value): value is PresentValue => !isBlank(value))
    const type = declaredTypes?.[name] ?? inferType(present)
    const stats: ColumnStats = {
      name,
      type,
      nonNull: present.length,
      nulls: Math.max(0, rows.length - present.length),
      unique: uniqueCount(present),
    }

    if (type === 'number') {
      const numbers = present.filter(isNumeric)
      if (numbers.length > 0) {
        stats.min = min(numbers)
        stats.max = max(numbers)
        stats.mean = mean(numbers)
      }
    }

    if (type === 'date') {
      const dates = present.filter(
        (value): value is Date => value instanceof Date,
      )
      if (dates.length > 0) {
        const minTime = min(dates, (value) => value.getTime())
        const maxTime = max(dates, (value) => value.getTime())
        stats.dateMin = minTime === undefined ? undefined : new Date(minTime)
        stats.dateMax = maxTime === undefined ? undefined : new Date(maxTime)
      }
    }

    return stats
  })
}

export function countByType(
  stats: ColumnStats[],
): Record<ColumnType, number> {
  const counts: Record<ColumnType, number> = {
    number: 0,
    date: 0,
    boolean: 0,
    text: 0,
    empty: 0,
  }
  for (const column of stats) counts[column.type] += 1
  return counts
}

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  number: 'Numeric',
  date: 'Date',
  boolean: 'Boolean',
  text: 'Text',
  empty: 'Empty',
}

export const COLUMN_TYPE_STYLES: Record<ColumnType, string> = {
  number:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  date: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  boolean:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  text: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  empty:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
}
