import type {
  CellValue,
  ColumnType,
  Dataset,
  FileKind,
  SavedDataView,
  SavedViewSort,
  UploadedFile,
} from '../types'
import type {
  RelationshipCandidate,
  RelationshipCardinality,
} from './relationships'

export const WORKSPACE_STORAGE_KEY = 'data-desk-workspace'
const WORKSPACE_VERSION = 1

interface StoredDateValue {
  __type: 'date'
  value: string
}

type StoredCellValue = string | number | boolean | null | StoredDateValue

interface StoredDataset {
  id: string
  fileId: string
  fileName: string
  fileKind: FileKind
  fileSize: number
  sheetName: string
  label: string
  columns: string[]
  rows: Record<string, StoredCellValue>[]
  uploadedAt: number
  idColumn?: string
  columnTypes?: Record<string, ColumnType>
}

interface StoredUploadedFile {
  id: string
  name: string
  kind: FileKind
  size: number
  uploadedAt: number
  datasets: StoredDataset[]
}

interface StoredRelationship {
  id: string
  fromId: string
  toId: string
  fromColumn: string
  toColumn: string
  cardinality: RelationshipCardinality
  fromDistinct: number
  toDistinct: number
  fromUnique: boolean
  toUnique: boolean
  toHasNulls: boolean
  linkingSide: 'from' | 'to'
}

interface StoredWorkspace {
  version: typeof WORKSPACE_VERSION
  savedAt: number
  files: StoredUploadedFile[]
  relationships: StoredRelationship[]
  savedViews: SavedDataView[]
}

export interface WorkspaceSnapshot {
  files: UploadedFile[]
  relationships: RelationshipCandidate[]
  savedViews: SavedDataView[]
}

export interface StoredWorkspaceInfo {
  snapshot: WorkspaceSnapshot
  savedAt: number
  bytes: number
  raw: string
}

const FILE_KINDS = new Set<FileKind>(['csv', 'xlsx', 'xls', 'manual'])
const COLUMN_TYPES = new Set<ColumnType>([
  'number',
  'date',
  'boolean',
  'text',
  'empty',
])
const CARDINALITIES = new Set<RelationshipCardinality>([
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFileKind(value: unknown): value is FileKind {
  return typeof value === 'string' && FILE_KINDS.has(value as FileKind)
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    return null
  }
  return [...value]
}

function decodeCell(value: unknown): CellValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (
    isRecord(value) &&
    value.__type === 'date' &&
    typeof value.value === 'string'
  ) {
    const date = new Date(value.value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function decodeRow(value: unknown): Record<string, CellValue> | null {
  if (!isRecord(value)) return null
  const row: Record<string, CellValue> = {}
  for (const [key, cell] of Object.entries(value)) {
    row[key] = decodeCell(cell)
  }
  return row
}

function hydrateDataset(value: unknown): Dataset | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const fileId = asString(value.fileId)
  const sheetName = asString(value.sheetName)
  const fileKind = isFileKind(value.fileKind) ? value.fileKind : null
  const columns = asStringArray(value.columns)

  if (!id || !fileId || !sheetName || !fileKind || !columns) return null

  const rows = Array.isArray(value.rows)
    ? value.rows
        .map(decodeRow)
        .filter((row): row is Record<string, CellValue> => row !== null)
        .map((row) => {
          const normalized: Record<string, CellValue> = {}
          for (const column of columns) {
            normalized[column] = row[column] ?? null
          }
          return normalized
        })
    : []

  const columnTypes: Record<string, ColumnType> = {}
  if (isRecord(value.columnTypes)) {
    for (const [name, type] of Object.entries(value.columnTypes)) {
      if (typeof type === 'string' && COLUMN_TYPES.has(type as ColumnType)) {
        columnTypes[name] = type as ColumnType
      }
    }
  }

  const dataset: Dataset = {
    id,
    fileId,
    fileName: asString(value.fileName, sheetName),
    fileKind,
    fileSize: asNumber(value.fileSize),
    sheetName,
    label: asString(value.label, sheetName) || sheetName,
    columns,
    rows,
    uploadedAt: asNumber(value.uploadedAt),
  }

  if (typeof value.idColumn === 'string' && value.idColumn !== '') {
    dataset.idColumn = value.idColumn
  }
  if (Object.keys(columnTypes).length > 0) {
    dataset.columnTypes = columnTypes
  }

  return dataset
}

function hydrateFile(value: unknown): UploadedFile | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const kind = isFileKind(value.kind) ? value.kind : null
  if (!id || !kind || !Array.isArray(value.datasets)) return null

  const datasets = value.datasets
    .map(hydrateDataset)
    .filter((dataset): dataset is Dataset => dataset !== null)

  if (datasets.length === 0) return null

  return {
    id,
    name: asString(value.name, 'Untitled file'),
    kind,
    size: asNumber(value.size),
    uploadedAt: asNumber(value.uploadedAt),
    datasets,
  }
}

function hydrateRelationship(
  value: unknown,
  datasetsById: Map<string, Dataset>,
): RelationshipCandidate | null {
  if (!isRecord(value)) return null

  const fromId = asString(value.fromId)
  const toId = asString(value.toId)
  const fromColumn = asString(value.fromColumn)
  const toColumn = asString(value.toColumn)
  const from = datasetsById.get(fromId)
  const to = datasetsById.get(toId)

  if (!from || !to) return null
  if (
    !from.columns.includes(fromColumn) ||
    !to.columns.includes(toColumn)
  ) {
    return null
  }

  const cardinality =
    typeof value.cardinality === 'string' &&
    CARDINALITIES.has(value.cardinality as RelationshipCardinality)
      ? (value.cardinality as RelationshipCardinality)
      : 'many-to-one'

  return {
    id:
      asString(value.id) ||
      `${fromId}:${fromColumn}->${toId}:${toColumn}`,
    from,
    to,
    fromColumn,
    toColumn,
    cardinality,
    fromDistinct: asNumber(value.fromDistinct),
    toDistinct: asNumber(value.toDistinct),
    fromUnique: value.fromUnique === true,
    toUnique: value.toUnique === true,
    toHasNulls: value.toHasNulls === true,
    linkingSide: value.linkingSide === 'to' ? 'to' : 'from',
  }
}

function hydrateSavedView(
  value: unknown,
  datasetIds: Set<string>,
): SavedDataView | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  const name = asString(value.name)
  const datasetId = asString(value.datasetId)
  if (!id || !name || !datasetId || !datasetIds.has(datasetId)) return null

  const columnFilters: Record<string, string> = {}
  if (isRecord(value.columnFilters)) {
    for (const [column, filter] of Object.entries(value.columnFilters)) {
      if (typeof filter === 'string') columnFilters[column] = filter
    }
  }

  const sort: SavedViewSort | null = (() => {
    if (!isRecord(value.sort)) return null
    const key = value.sort.key
    const direction = value.sort.direction
    if (typeof key === 'string' && direction === 'asc') {
      return { key, direction: 'asc' }
    }
    if (typeof key === 'string' && direction === 'desc') {
      return { key, direction: 'desc' }
    }
    return null
  })()

  return {
    id,
    name,
    datasetId,
    query: asString(value.query),
    columnFilters,
    pageSize: Math.max(1, Math.trunc(asNumber(value.pageSize, 25))),
    page: Math.max(0, Math.trunc(asNumber(value.page))),
    sort,
    includedJoinIds: asStringArray(value.includedJoinIds) ?? [],
    hiddenColumns: asStringArray(value.hiddenColumns) ?? [],
    onlyMatchedBase: value.onlyMatchedBase === true,
    onlyMatchedJoined: value.onlyMatchedJoined === true,
    onlyUnmatchedBase: value.onlyUnmatchedBase === true,
    onlyUnmatchedJoined: value.onlyUnmatchedJoined === true,
  }
}

function hydrateWorkspace(raw: unknown): WorkspaceSnapshot | null {
  if (!isRecord(raw)) return null
  if (raw.version !== WORKSPACE_VERSION) return null
  if (!Array.isArray(raw.files) || !Array.isArray(raw.relationships)) {
    return null
  }

  const files = raw.files
    .map(hydrateFile)
    .filter((file): file is UploadedFile => file !== null)

  const datasetsById = new Map<string, Dataset>()
  for (const file of files) {
    for (const dataset of file.datasets) datasetsById.set(dataset.id, dataset)
  }

  const relationships = raw.relationships
    .map((relationship) => hydrateRelationship(relationship, datasetsById))
    .filter(
      (relationship): relationship is RelationshipCandidate =>
        relationship !== null,
    )

  const datasetIds = new Set(datasetsById.keys())
  const savedViews = Array.isArray(raw.savedViews)
    ? raw.savedViews
        .map((view) => hydrateSavedView(view, datasetIds))
        .filter((view): view is SavedDataView => view !== null)
    : []

  return { files, relationships, savedViews }
}

function encodeCell(value: CellValue): StoredCellValue {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : { __type: 'date', value: value.toISOString() }
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  return value
}

function encodeRow(
  row: Record<string, CellValue>,
): Record<string, StoredCellValue> {
  const encoded: Record<string, StoredCellValue> = {}
  for (const [column, value] of Object.entries(row)) {
    encoded[column] = encodeCell(value)
  }
  return encoded
}

function serializeDataset(dataset: Dataset): StoredDataset {
  const stored: StoredDataset = {
    id: dataset.id,
    fileId: dataset.fileId,
    fileName: dataset.fileName,
    fileKind: dataset.fileKind,
    fileSize: dataset.fileSize,
    sheetName: dataset.sheetName,
    label: dataset.label,
    columns: [...dataset.columns],
    rows: dataset.rows.map(encodeRow),
    uploadedAt: dataset.uploadedAt,
  }
  if (dataset.idColumn) stored.idColumn = dataset.idColumn
  if (dataset.columnTypes) {
    stored.columnTypes = { ...dataset.columnTypes }
  }
  return stored
}

function serializeFile(file: UploadedFile): StoredUploadedFile {
  return {
    id: file.id,
    name: file.name,
    kind: file.kind,
    size: file.size,
    uploadedAt: file.uploadedAt,
    datasets: file.datasets.map(serializeDataset),
  }
}

function serializeRelationship(
  relationship: RelationshipCandidate,
): StoredRelationship {
  return {
    id: relationship.id,
    fromId: relationship.from.id,
    toId: relationship.to.id,
    fromColumn: relationship.fromColumn,
    toColumn: relationship.toColumn,
    cardinality: relationship.cardinality,
    fromDistinct: relationship.fromDistinct,
    toDistinct: relationship.toDistinct,
    fromUnique: relationship.fromUnique,
    toUnique: relationship.toUnique,
    toHasNulls: relationship.toHasNulls,
    linkingSide: relationship.linkingSide,
  }
}

function serializeWorkspace(snapshot: WorkspaceSnapshot): StoredWorkspace {
  return {
    version: WORKSPACE_VERSION,
    savedAt: Date.now(),
    files: snapshot.files.map(serializeFile),
    relationships: snapshot.relationships.map(serializeRelationship),
    savedViews: snapshot.savedViews.map((view) => ({
      ...view,
      columnFilters: { ...view.columnFilters },
      includedJoinIds: [...view.includedJoinIds],
      hiddenColumns: [...view.hiddenColumns],
    })),
  }
}

function parseWorkspaceText(text: string): {
  snapshot: WorkspaceSnapshot
  parsed: unknown
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  const snapshot = hydrateWorkspace(parsed)
  if (!snapshot) {
    throw new Error('This JSON is not a supported Data Desk workspace export.')
  }
  return { snapshot, parsed }
}

export function parseWorkspaceJson(text: string): WorkspaceSnapshot {
  return parseWorkspaceText(text).snapshot
}

export function readWorkspaceStorage(): StoredWorkspaceInfo | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return null
    const { snapshot, parsed } = parseWorkspaceText(raw)
    return {
      snapshot,
      savedAt: isRecord(parsed) ? asNumber(parsed.savedAt) : 0,
      bytes: new Blob([raw]).size,
      raw,
    }
  } catch {
    return null
  }
}

export function loadStoredWorkspace(): WorkspaceSnapshot | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return null
    return parseWorkspaceJson(raw)
  } catch {
    return null
  }
}

export function saveWorkspace(
  snapshot: WorkspaceSnapshot,
): { ok: true } | { ok: false; error: unknown } {
  try {
    const raw = JSON.stringify(serializeWorkspace(snapshot))
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, raw)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}
