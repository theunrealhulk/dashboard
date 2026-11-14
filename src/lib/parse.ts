import type { CellValue, ParsedDataset, ParsedFile } from '../types'
import { fileBaseName, fileKindFromName, formatCell } from './format'
import { isBlank } from './values'

function normalizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }
  return String(value)
}

function headerText(value: unknown, index: number): string {
  if (value instanceof Date) return formatCell(value)
  const text = value === null || value === undefined ? '' : String(value).trim()
  return text === '' ? `Column ${index + 1}` : text
}

function buildColumns(headerRow: unknown[], width: number): string[] {
  const seen = new Map<string, number>()
  const columns: string[] = []

  for (let index = 0; index < width; index += 1) {
    const base = headerText(headerRow[index], index)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    columns.push(count === 0 ? base : `${base} (${count + 1})`)
  }

  return columns
}

function buildDataset(
  matrix: unknown[][],
  sheetName: string,
  fileName: string,
  isCsv: boolean,
  isSingleSheet: boolean,
): ParsedDataset {
  const width = matrix.reduce((widest, row) => Math.max(widest, row.length), 0)
  const columns = buildColumns(matrix[0] ?? [], width)
  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, CellValue> = {}
    columns.forEach((column, index) => {
      row[column] = normalizeCell(cells[index])
    })
    return row
  })

  const filledRows = rows.filter((row) =>
    columns.some((column) => !isBlank(row[column])),
  )

  return {
    tempId: crypto.randomUUID(),
    sheetName,
    defaultLabel:
      isCsv || isSingleSheet ? fileBaseName(fileName) : sheetName,
    columns,
    rows: filledRows,
  }
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const kind = fileKindFromName(file.name)
  if (!kind) {
    throw new Error('Only .csv, .xlsx and .xls files are supported')
  }

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  if (workbook.SheetNames.length === 0) {
    throw new Error('The workbook does not contain any sheets')
  }

  const isSingleSheet = workbook.SheetNames.length === 1
  const datasets = workbook.SheetNames.map((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      {
        header: 1,
        defval: null,
        blankrows: false,
      },
    )
    return buildDataset(matrix, sheetName, file.name, kind === 'csv', isSingleSheet)
  })

  return { file, kind, datasets }
}
