export type FileKind = 'csv' | 'xlsx' | 'xls' | 'manual'

export type CellValue = string | number | boolean | Date | null

export interface Dataset {
  id: string
  fileId: string
  fileName: string
  fileKind: FileKind
  fileSize: number
  sheetName: string
  label: string
  columns: string[]
  rows: Record<string, CellValue>[]
  uploadedAt: number
  idColumn?: string
  columnTypes?: Record<string, ColumnType>
}

export interface UploadedFile {
  id: string
  name: string
  kind: FileKind
  size: number
  uploadedAt: number
  sourceFile?: File
  datasets: Dataset[]
}

export interface ParsedDataset {
  tempId: string
  sheetName: string
  defaultLabel: string
  columns: string[]
  rows: Record<string, CellValue>[]
}

export interface ParsedFile {
  file: File
  kind: FileKind
  datasets: ParsedDataset[]
}

export type ColumnType = 'number' | 'date' | 'boolean' | 'text' | 'empty'

export interface EntityColumn {
  name: string
  type: ColumnType
}

export interface ColumnStats {
  name: string
  type: ColumnType
  nonNull: number
  nulls: number
  unique: number
  min?: number
  max?: number
  mean?: number
  dateMin?: Date
  dateMax?: Date
}

export interface ToastMessage {
  id: string
  kind: 'success' | 'error' | 'info'
  message: string
}

export interface ForeignKeyLink {
  column: string
  targetDatasetId: string
  targetDatasetLabel: string
  targetColumn: string
}

export interface JoinedTable {
  id: string
  label: string
  sourceColumn: string
  targetColumn: string
  dataset: Dataset
}

export interface SavedViewSort {
  key: string
  direction: 'asc' | 'desc'
}

export interface SavedDataView {
  id: string
  name: string
  datasetId: string
  query: string
  columnFilters: Record<string, string>
  pageSize: number
  page: number
  sort: SavedViewSort | null
  includedJoinIds: string[]
  hiddenColumns: string[]
  onlyMatchedBase: boolean
  onlyMatchedJoined: boolean
  onlyUnmatchedBase: boolean
  onlyUnmatchedJoined: boolean
}

export interface DataFocus {
  datasetId: string
  column: string
  value: CellValue
  sourceLabel: string
  sourceColumn: string
  nonce: number
}
