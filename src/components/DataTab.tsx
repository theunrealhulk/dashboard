import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  ExternalLink,
  Filter,
  FilterX,
  KeyRound,
  Link2,
  Plus,
  Save,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { csvFormat } from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CellValue,
  ColumnType,
  DataFocus,
  Dataset,
  ForeignKeyLink,
  JoinedTable,
  SavedDataView,
} from '../types'
import { formatCell, formatForExport, formatInteger } from '../lib/format'
import { cellKey, isBlank } from '../lib/values'
import { SaveViewModal } from './SaveViewModal'

const PAGE_SIZES = [10, 25, 50, 100]

const JOIN_TINTS = [
  {
    header: 'bg-sky-50 dark:bg-sky-950',
    filter: 'bg-sky-100 dark:bg-sky-900',
    cell: 'bg-sky-50/60 dark:bg-sky-500/5',
    dot: 'bg-sky-400',
  },
  {
    header: 'bg-emerald-50 dark:bg-emerald-950',
    filter: 'bg-emerald-100 dark:bg-emerald-900',
    cell: 'bg-emerald-50/60 dark:bg-emerald-500/5',
    dot: 'bg-emerald-400',
  },
  {
    header: 'bg-amber-50 dark:bg-amber-950',
    filter: 'bg-amber-100 dark:bg-amber-900',
    cell: 'bg-amber-50/60 dark:bg-amber-500/5',
    dot: 'bg-amber-400',
  },
  {
    header: 'bg-rose-50 dark:bg-rose-950',
    filter: 'bg-rose-100 dark:bg-rose-900',
    cell: 'bg-rose-50/60 dark:bg-rose-500/5',
    dot: 'bg-rose-400',
  },
  {
    header: 'bg-violet-50 dark:bg-violet-950',
    filter: 'bg-violet-100 dark:bg-violet-900',
    cell: 'bg-violet-50/60 dark:bg-violet-500/5',
    dot: 'bg-violet-400',
  },
  {
    header: 'bg-teal-50 dark:bg-teal-950',
    filter: 'bg-teal-100 dark:bg-teal-900',
    cell: 'bg-teal-50/60 dark:bg-teal-500/5',
    dot: 'bg-teal-400',
  },
]

type SortDirection = 'asc' | 'desc'

interface SortState {
  key: string
  direction: SortDirection
}

function compareValues(left: CellValue, right: CellValue): number {
  const leftBlank = isBlank(left)
  const rightBlank = isBlank(right)
  if (leftBlank && rightBlank) return 0
  if (leftBlank) return 1
  if (rightBlank) return -1
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime()
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function SortIndicator({ direction }: { direction: SortDirection | null }) {
  if (direction === 'asc') {
    return <ArrowUp className="h-3.5 w-3.5 shrink-0" />
  }
  if (direction === 'desc') {
    return <ArrowDown className="h-3.5 w-3.5 shrink-0" />
  }
  return (
    <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500" />
  )
}

function inputValue(value: CellValue): string {
  if (value === null) return ''
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value)
}

function parseInput(raw: string, type: ColumnType = 'text'): CellValue {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  if (type === 'number') {
    const number = Number(trimmed)
    return Number.isFinite(number) ? number : trimmed
  }

  if (type === 'boolean') {
    const lower = trimmed.toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false
    return trimmed
  }

  if (type === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      )
    }
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? trimmed : date
  }

  return trimmed
}

function PageButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

interface DataTabProps {
  dataset: Dataset
  foreignKeyLinks: ForeignKeyLink[]
  joinedTables?: JoinedTable[]
  savedView?: SavedDataView | null
  onSaveView?: (view: Omit<SavedDataView, 'id'>) => void
  focus: DataFocus | null
  onNavigateToRelatedRow: (link: ForeignKeyLink, value: CellValue) => void
  onNavigateBack: () => void
  canNavigateBack: boolean
  onClearFocus: () => void
  editable?: boolean
  onAddRow?: () => void
  onUpdateCell?: (rowIndex: number, column: string, value: CellValue) => void
  onDeleteRow?: (rowIndex: number) => void
}

export function DataTab({
  dataset,
  foreignKeyLinks,
  joinedTables = [],
  savedView = null,
  onSaveView,
  focus,
  onNavigateToRelatedRow,
  onNavigateBack,
  canNavigateBack,
  onClearFocus,
  editable = false,
  onAddRow,
  onUpdateCell,
  onDeleteRow,
}: DataTabProps) {
  const [query, setQuery] = useState(() => savedView?.query ?? '')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    () => ({ ...(savedView?.columnFilters ?? {}) }),
  )
  const [pageSize, setPageSize] = useState(() => savedView?.pageSize ?? 25)
  const [page, setPage] = useState(() => savedView?.page ?? 0)
  const [sort, setSort] = useState<SortState | null>(
    () => savedView?.sort ?? null,
  )
  const [editing, setEditing] = useState<{
    rowId: number
    rowIndex: number
    column: string
    value: string
  } | null>(null)
  const cancelEditRef = useRef(false)
  const [includedJoinIds, setIncludedJoinIds] = useState<string[]>(
    () => [...(savedView?.includedJoinIds ?? [])],
  )
  const [joinPickerOpen, setJoinPickerOpen] = useState(false)
  const [onlyMatchedBase, setOnlyMatchedBase] = useState(
    () => savedView?.onlyMatchedBase ?? false,
  )
  const [onlyMatchedJoined, setOnlyMatchedJoined] = useState(
    () => savedView?.onlyMatchedJoined ?? false,
  )
  const [onlyUnmatchedBase, setOnlyUnmatchedBase] = useState(
    () => savedView?.onlyUnmatchedBase ?? false,
  )
  const [onlyUnmatchedJoined, setOnlyUnmatchedJoined] = useState(
    () => savedView?.onlyUnmatchedJoined ?? false,
  )
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(
    () => [...(savedView?.hiddenColumns ?? [])],
  )
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [columnQuery, setColumnQuery] = useState('')
  const [saveViewOpen, setSaveViewOpen] = useState(false)

  const activeJoins = useMemo(
    () => joinedTables.filter((join) => includedJoinIds.includes(join.id)),
    [includedJoinIds, joinedTables],
  )
  const baseFilterLabel = dataset.label
  const joinedFilterLabel = activeJoins
    .map((join) => join.label)
    .join(' + ')

  const joinedView = useMemo(() => {
    if (activeJoins.length === 0) {
      return {
        columns: dataset.columns,
        rows: dataset.rows,
        rowMeta: new Map(
          dataset.rows.map(
            (row, index) =>
              [row, { sourceIndex: index, rowId: index }] as const,
          ),
        ),
        columnTints: new Map<string, number>(),
        joinGroups: [] as string[][],
      }
    }

    const usedColumns = new Set(dataset.columns)
    const columns = [...dataset.columns]
    const columnTints = new Map<string, number>()
    const joinPlans = activeJoins.map((join) => {
      const tintIndex = Math.max(0, joinedTables.indexOf(join))
      const names: string[] = []
      for (const column of join.dataset.columns) {
        const base = `${join.label}.${column}`
        let name = base
        let suffix = 2
        while (usedColumns.has(name)) {
          name = `${base} (${suffix})`
          suffix += 1
        }
        usedColumns.add(name)
        columns.push(name)
        columnTints.set(name, tintIndex)
        names.push(name)
      }

      const matches = new Map<string, Record<string, CellValue>[]>()
      for (const targetRow of join.dataset.rows) {
        const key = cellKey(targetRow[join.targetColumn])
        if (key === null) continue
        const bucket = matches.get(key)
        if (bucket) bucket.push(targetRow)
        else matches.set(key, [targetRow])
      }

      return { join, names, matches }
    })

    let partials: {
      row: Record<string, CellValue>
      sourceIndex: number
    }[] = dataset.rows.map((row, sourceIndex) => ({
      row: { ...row },
      sourceIndex,
    }))

    joinPlans.forEach(({ join, names, matches }, planIndex) => {
      const matchedTargets = new Set<Record<string, CellValue>>()
      const next: typeof partials = []

      for (const partial of partials) {
        const key = cellKey(partial.row[join.sourceColumn])
        const targetRows = key === null ? undefined : matches.get(key)
        if (!targetRows || targetRows.length === 0) {
          const expanded = { ...partial.row }
          for (const name of names) expanded[name] = null
          next.push({ row: expanded, sourceIndex: partial.sourceIndex })
          continue
        }

        for (const targetRow of targetRows) {
          matchedTargets.add(targetRow)
          const expanded = { ...partial.row }
          join.dataset.columns.forEach((column, columnIndex) => {
            expanded[names[columnIndex]] = targetRow[column]
          })
          next.push({ row: expanded, sourceIndex: partial.sourceIndex })
        }
      }

      const blank: Record<string, CellValue> = {}
      for (const column of dataset.columns) blank[column] = null
      for (let previous = 0; previous < planIndex; previous += 1) {
        for (const name of joinPlans[previous].names) blank[name] = null
      }

      for (const targetRow of join.dataset.rows) {
        if (matchedTargets.has(targetRow)) continue
        const expanded = { ...blank }
        join.dataset.columns.forEach((column, columnIndex) => {
          expanded[names[columnIndex]] = targetRow[column]
        })
        next.push({ row: expanded, sourceIndex: -1 })
      }

      partials = next
    })

    const rowMeta = new Map<
      Record<string, CellValue>,
      { sourceIndex: number; rowId: number }
    >()
    const rows: Record<string, CellValue>[] = []
    let nextRowId = 0
    for (const partial of partials) {
      rowMeta.set(partial.row, {
        sourceIndex: partial.sourceIndex,
        rowId: nextRowId,
      })
      nextRowId += 1
      rows.push(partial.row)
    }

    return {
      columns,
      rows,
      rowMeta,
      columnTints,
      joinGroups: joinPlans.map((plan) => plan.names),
    }
  }, [activeJoins, dataset, joinedTables])

  const viewColumns = joinedView.columns
  const viewRows = joinedView.rows
  const sourceColumns = useMemo(
    () => new Set(dataset.columns),
    [dataset.columns],
  )
  const visibleViewColumns = useMemo(
    () =>
      viewColumns.filter((column) => !hiddenColumns.includes(column)),
    [hiddenColumns, viewColumns],
  )
  const normalizedColumnQuery = columnQuery.trim().toLowerCase()
  const filteredColumnOptions = useMemo(
    () =>
      normalizedColumnQuery === ''
        ? viewColumns
        : viewColumns.filter((column) =>
            column.toLowerCase().includes(normalizedColumnQuery),
          ),
    [normalizedColumnQuery, viewColumns],
  )
  const allColumnsVisible =
    viewColumns.length > 0 &&
    visibleViewColumns.length === viewColumns.length

  const normalizedQuery = query.trim().toLowerCase()
  const activeFocus =
    focus && focus.datasetId === dataset.id ? focus : null
  const activeFocusKey = activeFocus ? cellKey(activeFocus.value) : null
  const hasActiveFocus = activeFocus !== null && activeFocusKey !== null

  const foreignKeyByColumn = useMemo(() => {
    const links = new Map<string, ForeignKeyLink>()
    for (const link of foreignKeyLinks) {
      if (!links.has(link.column)) links.set(link.column, link)
    }
    return links
  }, [foreignKeyLinks])

  useEffect(() => {
    if (!activeFocus) return
    setQuery('')
    setColumnFilters({})
    setSort(null)
    setPage(0)
  }, [activeFocus])

  useEffect(() => {
    if (!joinPickerOpen && !columnsMenuOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setJoinPickerOpen(false)
        setColumnsMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [columnsMenuOpen, joinPickerOpen])

  const activeColumnFilters = useMemo(
    () =>
      visibleViewColumns
        .map((column) => ({
          column,
          needle: (columnFilters[column] ?? '').trim().toLowerCase(),
        }))
        .filter((filter) => filter.needle !== ''),
    [columnFilters, visibleViewColumns],
  )

  const activeFilterCount = activeColumnFilters.length
  const hasJoinFilters =
    activeJoins.length > 0 &&
    (onlyMatchedBase ||
      onlyMatchedJoined ||
      onlyUnmatchedBase ||
      onlyUnmatchedJoined)
  const hasActiveFilters =
    normalizedQuery !== '' || activeFilterCount > 0 || hasJoinFilters

  const filteredRows = useMemo(() => {
    if (!hasActiveFilters && !hasActiveFocus) return viewRows

    return viewRows.filter((row) => {
      if (
        activeFocus &&
        activeFocusKey !== null &&
        cellKey(row[activeFocus.column]) !== activeFocusKey
      ) {
        return false
      }

      if (hasJoinFilters) {
        const meta = joinedView.rowMeta.get(row)
        const hasBase = meta !== undefined && meta.sourceIndex >= 0
        const hasJoinedMatch = joinedView.joinGroups.every(
          (group) => !group.every((column) => isBlank(row[column])),
        )
        if (onlyMatchedBase && !hasBase) return false
        if (onlyUnmatchedBase && hasBase) return false
        if (onlyMatchedJoined && !hasJoinedMatch) return false
        if (onlyUnmatchedJoined && hasJoinedMatch) return false
      }

      if (
        normalizedQuery &&
        !visibleViewColumns.some((column) =>
          formatCell(row[column]).toLowerCase().includes(normalizedQuery),
        )
      ) {
        return false
      }

      return activeColumnFilters.every((filter) =>
        formatCell(row[filter.column])
          .toLowerCase()
          .includes(filter.needle),
      )
    })
  }, [
    activeColumnFilters,
    activeFocus,
    activeFocusKey,
    hasActiveFilters,
    hasActiveFocus,
    hasJoinFilters,
    joinedView,
    normalizedQuery,
    onlyMatchedBase,
    onlyMatchedJoined,
    onlyUnmatchedBase,
    onlyUnmatchedJoined,
    viewRows,
    visibleViewColumns,
  ])

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows
    const direction = sort.direction === 'asc' ? 1 : -1
    return [...filteredRows].sort(
      (left, right) =>
        compareValues(left[sort.key], right[sort.key]) * direction,
    )
  }, [filteredRows, sort])

  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const startIndex = currentPage * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRows)
  const pageRows = sortedRows.slice(startIndex, endIndex)
  const hasActiveControls = hasActiveFilters || hasActiveFocus
  const emptyTitle = activeFocus
    ? 'Linked row not found'
    : hasActiveFilters
      ? 'No matching rows'
      : 'No rows to show'
  const emptyHint = activeFocus
    ? 'The referenced row could not be found in this sheet.'
    : hasActiveFilters
      ? 'Try adjusting your search or column filters.'
      : 'This dataset does not contain any data rows.'

  function clearFocus() {
    setPage(0)
    onClearFocus()
  }

  function updateQuery(value: string) {
    if (activeFocus) onClearFocus()
    setQuery(value)
    setPage(0)
  }

  function updateColumnFilter(column: string, value: string) {
    if (activeFocus) onClearFocus()
    setColumnFilters((previous) => {
      const next = { ...previous }
      if (value === '') delete next[column]
      else next[column] = value
      return next
    })
    setPage(0)
  }

  function clearColumnFilters() {
    setColumnFilters({})
    setPage(0)
  }

  function toggleSort(column: string) {
    setSort((previous) => {
      if (!previous || previous.key !== column) {
        return { key: column, direction: 'asc' }
      }
      if (previous.direction === 'asc') {
        return { key: column, direction: 'desc' }
      }
      return null
    })
    setPage(0)
  }

  function startEdit(
    rowId: number,
    rowIndex: number,
    column: string,
    value: CellValue,
  ) {
    cancelEditRef.current = false
    setEditing({ rowId, rowIndex, column, value: inputValue(value) })
  }

  function commitEdit() {
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      return
    }
    if (!editing) return
    const { rowIndex, column, value } = editing
    const type = dataset.columnTypes?.[column] ?? 'text'
    setEditing(null)
    onUpdateCell?.(rowIndex, column, parseInput(value, type))
  }

  function cancelEdit() {
    cancelEditRef.current = true
    setEditing(null)
  }

  function addRow() {
    setEditing(null)
    setQuery('')
    setColumnFilters({})
    setSort(null)
    if (activeFocus) onClearFocus()
    setPage(Math.floor(dataset.rows.length / pageSize))
    onAddRow?.()
  }

  function deleteRow(rowIndex: number) {
    if (editing?.rowIndex === rowIndex) setEditing(null)
    onDeleteRow?.(rowIndex)
  }

  function toggleJoin(joinId: string) {
    setIncludedJoinIds((previous) =>
      previous.includes(joinId)
        ? previous.filter((id) => id !== joinId)
        : [...previous, joinId],
    )
  }

  function handleIncludeJoins() {
    setColumnsMenuOpen(false)
    if (joinedTables.length === 1) {
      toggleJoin(joinedTables[0].id)
      return
    }
    if (joinedTables.length > 1) {
      setJoinPickerOpen((open) => !open)
    }
  }

  function toggleColumn(column: string) {
    const isHidden = hiddenColumns.includes(column)
    if (!isHidden && sort?.key === column) setSort(null)
    setHiddenColumns((previous) =>
      previous.includes(column)
        ? previous.filter((name) => name !== column)
        : [...previous, column],
    )
  }

  function toggleAllColumns() {
    if (allColumnsVisible) {
      setSort(null)
      setHiddenColumns(viewColumns)
    } else {
      setHiddenColumns([])
    }
  }

  function handleExport() {
    if (visibleViewColumns.length === 0) return
    const rows = viewRows.map((row) => {
      const entry: Record<string, string> = {}
      for (const column of visibleViewColumns) {
        entry[column] = formatForExport(row[column])
      }
      return entry
    })
    const csv = csvFormat(rows, visibleViewColumns)
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${
      dataset.label.replace(/[^\w.-]+/g, '_') || 'dataset'
    }.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function handleSaveView(name: string) {
    onSaveView?.({
      name,
      datasetId: dataset.id,
      query,
      columnFilters: { ...columnFilters },
      pageSize,
      page,
      sort,
      includedJoinIds: [...includedJoinIds],
      hiddenColumns: [...hiddenColumns],
      onlyMatchedBase,
      onlyMatchedJoined,
      onlyUnmatchedBase,
      onlyUnmatchedJoined,
    })
    setSaveViewOpen(false)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      {activeJoins.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOnlyMatchedBase((value) => !value)
              setOnlyUnmatchedBase(false)
              setOnlyUnmatchedJoined(false)
            }}
            aria-pressed={onlyMatchedBase}
            title={`Hide rows missing from ${baseFilterLabel}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              onlyMatchedBase
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">
              Matched {baseFilterLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyMatchedJoined((value) => !value)
              setOnlyUnmatchedJoined(false)
              setOnlyUnmatchedBase(false)
            }}
            aria-pressed={onlyMatchedJoined}
            title={`Hide rows missing a match in ${joinedFilterLabel}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              onlyMatchedJoined
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">
              Matched {joinedFilterLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyUnmatchedBase((value) => !value)
              setOnlyUnmatchedJoined(false)
              setOnlyMatchedBase(false)
            }}
            aria-pressed={onlyUnmatchedBase}
            title={`Show only rows missing from ${baseFilterLabel}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              onlyUnmatchedBase
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">
              Unmatched {baseFilterLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyUnmatchedJoined((value) => !value)
              setOnlyUnmatchedBase(false)
              setOnlyMatchedJoined(false)
            }}
            aria-pressed={onlyUnmatchedJoined}
            title={`Show only rows missing a match in ${joinedFilterLabel}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              onlyUnmatchedJoined
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">
              Unmatched {joinedFilterLabel}
            </span>
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-stretch gap-2 sm:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={query}
              autoComplete="off"
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search rows…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setJoinPickerOpen(false)
                if (!columnsMenuOpen) setColumnQuery('')
                setColumnsMenuOpen((open) => !open)
              }}
              aria-expanded={columnsMenuOpen}
              className="flex h-full items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Columns3 className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="flex-1 text-left">Columns</span>
              <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                {visibleViewColumns.length}/{viewColumns.length}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition dark:text-slate-500 ${
                  columnsMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {columnsMenuOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setColumnsMenuOpen(false)}
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label="Close columns"
                />
                <div className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={columnQuery}
                      autoComplete="off"
                      onChange={(event) =>
                        setColumnQuery(event.target.value)
                      }
                      placeholder="Find column…"
                      aria-label="Find column"
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                    />
                    {columnQuery && (
                      <button
                        type="button"
                        onClick={() => setColumnQuery('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        aria-label="Clear column search"
                        title="Clear column search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      <input
                        type="checkbox"
                        checked={allColumnsVisible}
                        onChange={toggleAllColumns}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-950"
                      />
                      Select all
                    </label>
                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      {visibleViewColumns.length}/{viewColumns.length}
                    </span>
                  </div>
                  <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto">
                    {filteredColumnOptions.map((column) => {
                      const tintIndex = joinedView.columnTints.get(column)
                      const tint =
                        tintIndex === undefined
                          ? undefined
                          : JOIN_TINTS[tintIndex % JOIN_TINTS.length]
                      return (
                        <label
                          key={column}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.includes(column)}
                            onChange={() => toggleColumn(column)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-950"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                            {column}
                          </span>
                          {tint && (
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${tint.dot}`}
                            />
                          )}
                        </label>
                      )
                    })}
                    {filteredColumnOptions.length === 0 && (
                      <p className="px-2 py-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
                        No columns found.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearColumnFilters}
              className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              aria-label={`Clear ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
              title={`Clear ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
            >
              <FilterX className="h-3.5 w-3.5" />
            </button>
          )}

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {formatInteger(totalRows)} row{totalRows === 1 ? '' : 's'}
          </span>
          {joinedTables.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={handleIncludeJoins}
                aria-expanded={
                  joinedTables.length > 1 ? joinPickerOpen : undefined
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  activeJoins.length > 0
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Include joined tables
                {joinedTables.length > 1 && activeJoins.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                    {activeJoins.length}
                  </span>
                )}
              </button>
              {joinPickerOpen && joinedTables.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setJoinPickerOpen(false)}
                    className="fixed inset-0 z-20 cursor-default"
                    aria-label="Close joined tables"
                  />
                  <div className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Joined tables
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      Choose related tables to stitch with a full outer join.
                    </p>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                      {joinedTables.map((join) => (
                        <label
                          key={join.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={includedJoinIds.includes(join.id)}
                            onChange={() => toggleJoin(join.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-950"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                              {join.label}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                              {join.sourceColumn} → {join.targetColumn}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIncludedJoinIds([])}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinPickerOpen(false)}
                        className="rounded-md bg-indigo-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-600"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          {editable && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600"
              aria-label="Add row"
              title="Add row"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={
              dataset.rows.length === 0 || visibleViewColumns.length === 0
            }
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Export CSV"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setSaveViewOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
            aria-label="Save view"
            title="Save view"
          >
            <Save className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeFocus && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 leading-relaxed">
            Linked from{' '}
            <span className="font-semibold">{activeFocus.sourceLabel}</span>
            <span className="font-mono">.{activeFocus.sourceColumn}</span>{' '}
            · showing rows where{' '}
            <span className="font-mono">{activeFocus.column}</span> ={' '}
            <span className="font-mono">
              {formatCell(activeFocus.value)}
            </span>
          </span>
          {canNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-white/70 p-1.5 text-indigo-600 transition hover:bg-white hover:text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
              aria-label={`Back to ${activeFocus.sourceLabel}`}
              title={`Back to ${activeFocus.sourceLabel}`}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={clearFocus}
            className="rounded-md p-1 text-indigo-500 transition hover:bg-indigo-100 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
            aria-label="Clear linked row"
            title="Clear linked row"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="scrollbar-thin max-h-[62vh] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="w-12 border-b border-slate-200 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  #
                </th>
                {visibleViewColumns.map((column) => {
                  const direction =
                    sort?.key === column ? sort.direction : null
                  const foreignKey = foreignKeyByColumn.get(column)
                  const isPrimaryKey = dataset.idColumn === column
                  const tintIndex = joinedView.columnTints.get(column)
                  const tint =
                    tintIndex === undefined
                      ? undefined
                      : JOIN_TINTS[tintIndex % JOIN_TINTS.length]
                  const isJoined = tint !== undefined
                  return (
                    <th
                      key={column}
                      className={`border-b border-slate-200 px-3 py-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400 ${
                        tint?.header ?? ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        title={`Sort by ${column}`}
                        className={`group flex w-full items-center gap-1.5 py-2.5 text-left transition hover:text-slate-800 dark:hover:text-slate-200 ${
                          direction
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : ''
                        }`}
                      >
                        <span className="max-w-[200px] truncate">
                          {column}
                        </span>
                        {isPrimaryKey ? (
                          <span className="inline-flex shrink-0 items-center text-yellow-500 dark:text-yellow-400" title="Primary key">
                            <KeyRound className="h-3 w-3" />
                          </span>
                        ) : foreignKey ? (
                          <span
                            className="inline-flex shrink-0 items-center text-cyan-500 dark:text-cyan-400"
                            title={`Foreign key → ${foreignKey.targetDatasetLabel}.${foreignKey.targetColumn}`}
                          >
                            <KeyRound className="h-3 w-3" />
                          </span>
                        ) : isJoined ? (
                          <span
                            className="inline-flex shrink-0 items-center text-indigo-400 dark:text-indigo-400"
                            title="Joined column"
                          >
                            <Link2 className="h-3 w-3" />
                          </span>
                        ) : null}
                        <SortIndicator direction={direction} />
                      </button>
                    </th>
                  )
                })}
                {editable && (
                  <th className="w-12 border-b border-slate-200 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
              <tr>
                <th className="border-b border-slate-200 bg-slate-100 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <Filter className="ml-auto h-3 w-3 text-slate-400 dark:text-slate-500" />
                </th>
                {visibleViewColumns.map((column) => {
                  const value = columnFilters[column] ?? ''
                  const tintIndex = joinedView.columnTints.get(column)
                  const tint =
                    tintIndex === undefined
                      ? undefined
                      : JOIN_TINTS[tintIndex % JOIN_TINTS.length]
                  return (
                    <th
                      key={column}
                      className={`border-b border-slate-200 px-2 py-1.5 dark:border-slate-700 ${
                        tint?.filter ??
                        'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      <div className="relative">
                        <Filter className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={value}
                          autoComplete="off"
                          onChange={(event) =>
                            updateColumnFilter(
                              column,
                              event.target.value,
                            )
                          }
                          placeholder="Filter"
                          aria-label={`Filter ${column}`}
                          className="w-full min-w-[110px] rounded-md border border-slate-200 bg-white py-1 pl-7 pr-6 text-[11px] font-normal normal-case tracking-normal text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                        />
                        {value && (
                          <button
                            type="button"
                            onClick={() => updateColumnFilter(column, '')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            aria-label={`Clear ${column} filter`}
                            title={`Clear ${column} filter`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  )
                })}
                {editable && (
                  <th className="border-b border-slate-200 bg-slate-100 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.map((row, position) => {
                const meta = joinedView.rowMeta.get(row)
                const rowIndex = meta?.sourceIndex ?? viewRows.indexOf(row)
                const rowId = meta?.rowId ?? rowIndex
                const hasSourceRow = rowIndex >= 0
                const focusedRow =
                  activeFocus !== null &&
                  activeFocusKey !== null &&
                  cellKey(row[activeFocus.column]) === activeFocusKey
                const rowNumber = hasSourceRow
                  ? focusedRow
                    ? rowIndex + 1
                    : startIndex + position + 1
                  : null

                return (
                  <tr
                    key={rowId}
                    className={`transition ${
                      focusedRow
                        ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/20'
                        : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5'
                    }`}
                  >
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300 dark:text-slate-600">
                      {rowNumber ?? '—'}
                    </td>
                    {visibleViewColumns.map((column) => {
                      const value = row[column]
                      const blank = isBlank(value)
                      const display = blank ? '—' : formatCell(value)
                      const foreignKey = foreignKeyByColumn.get(column)
                      const linkKey = foreignKey ? cellKey(value) : null
                      const columnType =
                        dataset.columnTypes?.[column] ?? 'text'
                      const canEdit =
                        editable &&
                        hasSourceRow &&
                        sourceColumns.has(column)
                      const isEditing =
                        canEdit &&
                        editing?.rowId === rowId &&
                        editing.column === column
                      const tintIndex = joinedView.columnTints.get(column)
                      const tint =
                        tintIndex === undefined
                          ? undefined
                          : JOIN_TINTS[tintIndex % JOIN_TINTS.length]

                      return (
                        <td
                          key={column}
                          className={`max-w-[280px] whitespace-nowrap ${
                            canEdit ? 'p-0' : 'px-3 py-2'
                          } ${tint?.cell ?? ''}`}
                        >
                          {canEdit ? (
                            isEditing ? (
                              columnType === 'boolean' ? (
                                <select
                                  autoFocus
                                  value={editing.value}
                                  onChange={(event) =>
                                    setEditing((previous) =>
                                      previous
                                        ? {
                                            ...previous,
                                            value: event.target.value,
                                          }
                                        : previous,
                                    )
                                  }
                                  onBlur={commitEdit}
                                  className="w-full rounded border border-indigo-400 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-indigo-100 dark:border-indigo-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-indigo-500/20"
                                >
                                  <option value="">—</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : (
                                <input
                                  type={
                                    columnType === 'number'
                                      ? 'number'
                                      : columnType === 'date'
                                        ? 'date'
                                        : 'text'
                                  }
                                  step={
                                    columnType === 'number'
                                      ? 'any'
                                      : undefined
                                  }
                                  autoFocus
                                  value={editing.value}
                                  onChange={(event) =>
                                    setEditing((previous) =>
                                      previous
                                        ? {
                                            ...previous,
                                            value: event.target.value,
                                          }
                                        : previous,
                                    )
                                  }
                                  onBlur={commitEdit}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      commitEdit()
                                    } else if (event.key === 'Escape') {
                                      event.preventDefault()
                                      cancelEdit()
                                    }
                                  }}
                                  className="w-full rounded border border-indigo-400 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-indigo-100 dark:border-indigo-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-indigo-500/20"
                                />
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(rowId, rowIndex, column, value)
                                }
                                title="Click to edit"
                                className={`block w-full truncate px-3 py-2 text-left text-sm transition hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 ${
                                  blank
                                    ? 'text-slate-300 dark:text-slate-600'
                                    : typeof value === 'number'
                                      ? 'tabular-nums text-slate-700 dark:text-slate-200'
                                      : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {blank ? '—' : formatCell(value)}
                              </button>
                            )
                          ) : foreignKey && linkKey !== null ? (
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToRelatedRow(foreignKey, value)
                              }
                              title={`Open ${foreignKey.targetDatasetLabel} where ${foreignKey.targetColumn} = ${display}`}
                              className="group/fk inline-flex max-w-full items-center gap-1 rounded text-left font-medium text-indigo-600 underline decoration-indigo-300 decoration-dotted underline-offset-2 transition hover:text-indigo-700 hover:decoration-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              <span className="truncate">{display}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition group-hover/fk:opacity-100" />
                            </button>
                          ) : (
                            <span
                              className={`block truncate ${
                                blank
                                  ? 'text-slate-300 dark:text-slate-600'
                                  : typeof value === 'number'
                                    ? 'tabular-nums text-slate-700 dark:text-slate-200'
                                    : 'text-slate-600 dark:text-slate-300'
                              }`}
                              title={blank ? undefined : display}
                            >
                              {display}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {editable && (
                      <td className="px-2 py-2 text-center">
                        {hasSourceRow ? (
                          <button
                            type="button"
                            onClick={() => deleteRow(rowIndex)}
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            aria-label={`Delete row ${rowNumber ?? ''}`}
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span
                            className="text-[11px] text-slate-300 dark:text-slate-600"
                            title="Rows from the joined table without a match"
                          >
                            —
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      visibleViewColumns.length + 1 + (editable ? 1 : 0)
                    }
                    className="px-3 py-12 text-center"
                  >
                    <Table2 className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {emptyTitle}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {emptyHint}
                    </p>
                    {editable && (
          <button
            type="button"
            onClick={addRow}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600"
            aria-label="Add first row"
            title="Add first row"
          >
            <Plus className="h-4 w-4" />
          </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {totalRows === 0
            ? 'No rows'
            : `Showing ${formatInteger(startIndex + 1)}–${formatInteger(
                endIndex,
              )} of ${formatInteger(totalRows)}`}
          {hasActiveControls && (
            <span className="text-slate-400 dark:text-slate-500">
              {' '}
              · filtered from {formatInteger(viewRows.length)}
            </span>
          )}
        </p>

        <div className="flex items-center gap-1">
          <PageButton
            icon={ChevronsLeft}
            label="First page"
            disabled={currentPage === 0}
            onClick={() => setPage(0)}
          />
          <PageButton
            icon={ChevronLeft}
            label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(Math.max(0, currentPage - 1))}
          />
          <span className="px-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            Page {currentPage + 1} of {totalPages}
          </span>
          <PageButton
            icon={ChevronRight}
            label="Next page"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
          />
          <PageButton
            icon={ChevronsRight}
            label="Last page"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          />
        </div>
      </div>

      {saveViewOpen && (
        <SaveViewModal
          onCancel={() => setSaveViewOpen(false)}
          onConfirm={handleSaveView}
        />
      )}
    </section>
  )
}
