import {
  Cable,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Info,
  Layers,
  Menu,
  Moon,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Sun,
  Table2,
  Tags,
  Vault,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './lib/useTheme'
import type {
  CellValue,
  ColumnType,
  DataFocus,
  Dataset,
  EntityColumn,
  ForeignKeyLink,
  JoinedTable,
  ParsedFile,
  SavedDataView,
  ToastMessage,
  UploadedFile,
} from './types'
import type { RelationshipCandidate } from './lib/relationships'
import { parseFile } from './lib/parse'
import { formatInteger } from './lib/format'
import { findRelationships } from './lib/relationships'
import { DataTab } from './components/DataTab'
import { InfoTab } from './components/InfoTab'
import { LabelModal } from './components/LabelModal'
import { RelationshipModal } from './components/RelationshipModal'
import { RelationsTab } from './components/RelationsTab'
import { RelationsDesigner } from './components/RelationsDesigner'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { UploadZone } from './components/UploadZone'
import { VaultModal } from './components/VaultModal'
import {
  loadStoredWorkspace,
  saveWorkspace,
} from './lib/workspaceStorage'
import type { WorkspaceSnapshot } from './lib/workspaceStorage'

type Tab = 'info' | 'data' | 'relations'

interface NavigationSnapshot {
  datasetId: string | null
  tab: Tab
  focus: DataFocus | null
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon
  title: string
  text: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {text}
      </p>
    </div>
  )
}

function App() {
  const { theme, toggleTheme } = useTheme()
  const [initialWorkspace] = useState(() => loadStoredWorkspace())
  const [files, setFiles] = useState<UploadedFile[]>(
    () => initialWorkspace?.files ?? [],
  )
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    () => initialWorkspace?.files[0]?.datasets[0]?.id ?? null,
  )
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(
    () => new Set(initialWorkspace?.files.map((file) => file.id) ?? []),
  )
  const [pending, setPending] = useState<ParsedFile[] | null>(null)
  const [view, setView] = useState<'workspace' | 'designer'>('workspace')
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [reloadingDatasetId, setReloadingDatasetId] = useState<string | null>(
    null,
  )
  const [pendingReload, setPendingReload] = useState<{
    fileId: string
    datasetId: string
  } | null>(null)
  const [relationships, setRelationships] = useState<RelationshipCandidate[]>(
    () => initialWorkspace?.relationships ?? [],
  )
  const [savedViews, setSavedViews] = useState<SavedDataView[]>(
    () => initialWorkspace?.savedViews ?? [],
  )
  const [vaultOpen, setVaultOpen] = useState(false)
  const [restoredView, setRestoredView] = useState<{
    view: SavedDataView
    nonce: number
  } | null>(null)
  const [dataFocus, setDataFocus] = useState<DataFocus | null>(null)
  const [navigationHistory, setNavigationHistory] = useState<
    NavigationSnapshot[]
  >([])
  const focusNonceRef = useRef(0)
  const viewNonceRef = useRef(0)
  const storageErrorRef = useRef(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const datasetsById = useMemo(() => {
    const map = new Map<string, Dataset>()
    for (const file of files) {
      for (const dataset of file.datasets) map.set(dataset.id, dataset)
    }
    return map
  }, [files])

  const selectedDataset = useMemo(
    () =>
      selectedDatasetId ? (datasetsById.get(selectedDatasetId) ?? null) : null,
    [datasetsById, selectedDatasetId],
  )

  const activeRestoredView =
    restoredView && restoredView.view.datasetId === selectedDatasetId
      ? restoredView
      : null
  const backSnapshot = navigationHistory[navigationHistory.length - 1]
  const backDataset = backSnapshot?.datasetId
    ? datasetsById.get(backSnapshot.datasetId)
    : undefined

  const compareDatasets = useMemo(
    () =>
      compareIds
        .map((id) => datasetsById.get(id))
        .filter((dataset): dataset is Dataset => dataset !== undefined),
    [compareIds, datasetsById],
  )
  const firstCompare = compareDatasets[0]
  const secondCompare = compareDatasets[1]

  const compareCandidates = useMemo(() => {
    if (!firstCompare || !secondCompare) return []
    return findRelationships(firstCompare, secondCompare)
  }, [firstCompare, secondCompare])

  const totalDatasets = useMemo(
    () => files.reduce((total, file) => total + file.datasets.length, 0),
    [files],
  )

  const foreignKeyLinks = useMemo(() => {
    if (!selectedDataset) return []

    const bestByColumn = new Map<string, ForeignKeyLink>()
    for (const relationship of relationships) {
      const addLink = (
        column: string,
        targetDatasetId: string,
        targetDatasetLabel: string,
        targetColumn: string,
      ) => {
        const existing = bestByColumn.get(column)
        if (!existing) {
          bestByColumn.set(column, {
            column,
            targetDatasetId,
            targetDatasetLabel,
            targetColumn,
          })
        }
      }

      if (relationship.linkingSide === 'from') {
        if (relationship.from.id === selectedDataset.id) {
          addLink(
            relationship.fromColumn,
            relationship.to.id,
            relationship.to.label,
            relationship.toColumn,
          )
        }
      } else if (relationship.to.id === selectedDataset.id) {
        addLink(
          relationship.toColumn,
          relationship.from.id,
          relationship.from.label,
          relationship.fromColumn,
        )
      }
    }

    return [...bestByColumn.values()]
  }, [relationships, selectedDataset])

  const selectedDatasetJoins = useMemo<JoinedTable[]>(() => {
    if (!selectedDataset) return []
    const joins: JoinedTable[] = []
    const seen = new Set<string>()
    for (const relationship of relationships) {
      const isSource = relationship.from.id === selectedDataset.id
      const isTarget = relationship.to.id === selectedDataset.id
      if (!isSource && !isTarget) continue

      const targetId = isSource ? relationship.to.id : relationship.from.id
      const targetDataset = datasetsById.get(targetId)
      if (!targetDataset) continue

      const sourceColumn = isSource
        ? relationship.fromColumn
        : relationship.toColumn
      const targetColumn = isSource
        ? relationship.toColumn
        : relationship.fromColumn
      const id = `${sourceColumn}->${targetId}:${targetColumn}`
      if (seen.has(id)) continue
      seen.add(id)

      joins.push({
        id,
        label: targetDataset.label,
        sourceColumn,
        targetColumn,
        dataset: targetDataset,
      })
    }
    return joins
  }, [datasetsById, relationships, selectedDataset])

  const pushToast = useCallback(
    (message: string, kind: ToastMessage['kind'] = 'info') => {
      const id = crypto.randomUUID()
      setToasts((previous) =>
        [...previous, { id, kind, message }].slice(-4),
      )
      window.setTimeout(() => {
        setToasts((previous) =>
          previous.filter((toast) => toast.id !== id),
        )
      }, 5000)
    },
    [],
  )

  useEffect(() => {
    const result = saveWorkspace({ files, relationships, savedViews })
    if (result.ok) {
      storageErrorRef.current = false
      return
    }
    if (!storageErrorRef.current) {
      storageErrorRef.current = true
      pushToast(
        'Workspace could not be saved locally. Local storage may be full.',
        'error',
      )
    }
  }, [files, pushToast, relationships, savedViews])

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFiles(incoming: File[]) {
    if (incoming.length === 0) return
    setLoading(true)
    const parsed: ParsedFile[] = []
    const errors: string[] = []

    for (const file of incoming) {
      try {
        parsed.push(await parseFile(file))
      } catch (error) {
        errors.push(
          `${file.name}: ${
            error instanceof Error ? error.message : 'could not be read'
          }`,
        )
      }
    }

    setLoading(false)
    for (const message of errors) pushToast(message, 'error')

    if (parsed.length > 0) {
      setPending(parsed)
      setSidebarOpen(false)
    }
  }

  function handleConfirmLabels(
    labels: Record<string, string>,
    idColumns: Record<string, string>,
    addIdColumns: Record<string, boolean>,
  ) {
    if (!pending) return

    const uploadedAt = Date.now()

    if (pendingReload) {
      const { fileId, datasetId } = pendingReload
      const targetFile = files.find((file) => file.id === fileId)
      const datasetIndex = targetFile?.datasets.findIndex(
        (ds) => ds.id === datasetId,
      )
      const parsedDataset = pending[0].datasets[0]

      if (!targetFile || datasetIndex === undefined || datasetIndex === -1) {
        pushToast('Reload failed: sheet no longer exists', 'error')
        setPending(null)
        setPendingReload(null)
        return
      }

      const columns = [...parsedDataset.columns]
      const rows = parsedDataset.rows.map((row) => ({ ...row }))

      if (addIdColumns[parsedDataset.tempId]) {
        const idName = 'ID'
        if (!columns.includes(idName)) {
          columns.unshift(idName)
        }
        rows.forEach((row, index) => {
          if (row[idName] === undefined) row[idName] = index + 1
        })
      }

      const nextDatasets = [...targetFile.datasets]
      nextDatasets[datasetIndex] = {
        ...nextDatasets[datasetIndex],
        columns,
        rows,
        label:
          (labels[parsedDataset.tempId] ?? parsedDataset.defaultLabel).trim() ||
          parsedDataset.defaultLabel,
        uploadedAt,
        idColumn:
          idColumns[parsedDataset.tempId] ??
          targetFile.datasets[datasetIndex].idColumn ??
          undefined,
      }

      setFiles((previous) =>
        previous.map((file) =>
          file.id === fileId ? { ...file, datasets: nextDatasets } : file,
        ),
      )
      setRelationships((previous) =>
        previous.filter((relationship) => {
          const findDataset = (id: string) => {
            const updated = nextDatasets.find((dataset) => dataset.id === id)
            if (updated) return updated
            return files.flatMap((file) => file.datasets).find(
              (dataset) => dataset.id === id,
            )
          }
          const fromDataset = findDataset(relationship.from.id)
          const toDataset = findDataset(relationship.to.id)
          return (
            fromDataset !== undefined &&
            toDataset !== undefined &&
            fromDataset.columns.includes(relationship.fromColumn) &&
            toDataset.columns.includes(relationship.toColumn)
          )
        }),
      )
      setExpandedFileIds((previous) => {
        const next = new Set(previous)
        next.add(fileId)
        return next
      })

      setSelectedDatasetId(datasetId)
      setDataFocus(null)
      setActiveTab('info')

      setPending(null)
      setPendingReload(null)
      pushToast(`${nextDatasets[datasetIndex].label} reloaded`, 'success')
      return
    }

    const newFiles = pending.map<UploadedFile>((parsedFile) => {
      const nextFileId = crypto.randomUUID()
      const datasets = parsedFile.datasets.map<Dataset>((parsedDataset) => {
        const columns = [...parsedDataset.columns]
        const rows = parsedDataset.rows.map((row) => ({ ...row }))

        if (addIdColumns[parsedDataset.tempId]) {
          const idName = 'ID'
          columns.unshift(idName)
          rows.forEach((row, index) => {
            row[idName] = index + 1
          })
        }

        return {
          id: crypto.randomUUID(),
          fileId: nextFileId,
          fileName: parsedFile.file.name,
          fileKind: parsedFile.kind,
          fileSize: parsedFile.file.size,
          sheetName: parsedDataset.sheetName,
          label:
            (labels[parsedDataset.tempId] ?? parsedDataset.defaultLabel).trim() ||
            parsedDataset.defaultLabel,
          columns,
          rows,
          uploadedAt,
          idColumn: addIdColumns[parsedDataset.tempId]
            ? 'ID'
            : idColumns[parsedDataset.tempId] || undefined,
        }
      })

      return {
        id: nextFileId,
        name: parsedFile.file.name,
        kind: parsedFile.kind,
        size: parsedFile.file.size,
        uploadedAt,
        sourceFile: parsedFile.file,
        datasets,
      }
    })

    setFiles((previous) => [...previous, ...newFiles])
    setExpandedFileIds((previous) => {
      const next = new Set(previous)
      for (const file of newFiles) next.add(file.id)
      return next
    })

    const firstDataset = newFiles[0]?.datasets[0]
    if (firstDataset) {
      setSelectedDatasetId(firstDataset.id)
      setDataFocus(null)
      setActiveTab('info')
    }

    setPending(null)
    const added = newFiles.reduce(
      (total, file) => total + file.datasets.length,
      0,
    )
    pushToast(
      `${added} dataset${added === 1 ? '' : 's'} added to the workspace`,
      'success',
    )
  }

  function handleToggleFile(fileId: string) {
    setExpandedFileIds((previous) => {
      const next = new Set(previous)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  function handleSelectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId)
    setRestoredView(null)
    setDataFocus(null)
    setNavigationHistory([])
    setSidebarOpen(false)
  }

  function handleToggleCompareMode() {
    setCompareMode((current) => !current)
    setCompareIds([])
  }

  function handleToggleCompareDataset(datasetId: string) {
    const picked = compareIds.includes(datasetId)
    let next: string[]

    if (picked) {
      next = compareIds.filter((id) => id !== datasetId)
    } else if (compareIds.length >= 2) {
      next = [compareIds[1], datasetId]
    } else {
      next = [...compareIds, datasetId]
    }

    setCompareIds(next)
    if (!picked && next.length === 2) setSidebarOpen(false)
  }

  function handleClearCompare() {
    setCompareIds([])
  }

  async function handleReloadDataset(datasetId: string) {
    let targetFile: UploadedFile | undefined
    let targetDataset: Dataset | undefined

    for (const file of files) {
      const dataset = file.datasets.find((ds) => ds.id === datasetId)
      if (dataset) {
        targetFile = file
        targetDataset = dataset
        break
      }
    }

    if (!targetFile?.sourceFile || !targetDataset) return

    setReloadingDatasetId(datasetId)
    setLoading(true)

    try {
      const parsed = await parseFile(targetFile.sourceFile)
      const parsedDataset =
        parsed.datasets.find((ds) => ds.sheetName === targetDataset.sheetName) ??
        parsed.datasets[0]

      if (!parsedDataset) {
        throw new Error('Sheet not found in re-uploaded file')
      }

      setPending([
        {
          file: targetFile.sourceFile,
          kind: targetFile.kind,
          datasets: [parsedDataset],
        },
      ])
      setPendingReload({ fileId: targetFile.id, datasetId: targetDataset.id })
      pushToast(`${targetDataset.label}: review label and options`, 'info')
    } catch (error) {
      pushToast(
        `Reload failed: ${
          error instanceof Error ? error.message : 'could not reload'
        }`,
        'error',
      )
    } finally {
      setLoading(false)
      setReloadingDatasetId(null)
    }
  }

  function handleAddColumn(
    datasetId: string,
    columnName: string,
    defaultValue: CellValue = null,
    type?: ColumnType,
  ) {
    const name = columnName.trim()
    if (!name) return
    const inferredType: ColumnType =
      type ??
      (defaultValue instanceof Date
        ? 'date'
        : typeof defaultValue === 'number'
          ? 'number'
          : typeof defaultValue === 'boolean'
            ? 'boolean'
            : 'text')
    setFiles((previous) =>
      previous.map((file) => {
        if (!file.datasets.some((dataset) => dataset.id === datasetId)) {
          return file
        }
        return {
          ...file,
          datasets: file.datasets.map((dataset) => {
            if (dataset.id !== datasetId || dataset.columns.includes(name)) {
              return dataset
            }
            return {
              ...dataset,
              columns: [...dataset.columns, name],
              columnTypes: {
                ...dataset.columnTypes,
                [name]: inferredType,
              },
              rows: dataset.rows.map((row) => ({
                ...row,
                [name]: defaultValue,
              })),
            }
          }),
        }
      }),
    )
  }

  function handleCreateEntity(label: string, columns: EntityColumn[]) {
    const entityLabel = label.trim()
    const entityColumns = columns
      .map((column) => ({ ...column, name: column.name.trim() }))
      .filter((column) => column.name !== '')
    if (!entityLabel || entityColumns.length === 0) return

    const fileId = crypto.randomUUID()
    const datasetId = crypto.randomUUID()
    const uploadedAt = Date.now()
    const columnTypes: Record<string, ColumnType> = {}
    for (const column of entityColumns) {
      columnTypes[column.name] = column.type
    }

    const dataset: Dataset = {
      id: datasetId,
      fileId,
      fileName: entityLabel,
      fileKind: 'manual',
      fileSize: 0,
      sheetName: entityLabel,
      label: entityLabel,
      columns: entityColumns.map((column) => column.name),
      rows: [],
      uploadedAt,
      idColumn: entityColumns.find(
        (column) => column.name.toLowerCase() === 'id',
      )?.name,
      columnTypes,
    }

    const file: UploadedFile = {
      id: fileId,
      name: entityLabel,
      kind: 'manual',
      size: 0,
      uploadedAt,
      datasets: [dataset],
    }

    setFiles((previous) => [...previous, file])
    setExpandedFileIds((previous) => {
      const next = new Set(previous)
      next.add(fileId)
      return next
    })
    setSelectedDatasetId(datasetId)
    setDataFocus(null)
    pushToast(`${entityLabel} created`, 'success')
  }

  function handleAddRow(datasetId: string) {
    setFiles((previous) =>
      previous.map((file) => {
        if (!file.datasets.some((dataset) => dataset.id === datasetId)) {
          return file
        }
        return {
          ...file,
          datasets: file.datasets.map((dataset) => {
            if (dataset.id !== datasetId) return dataset
            const row: Record<string, CellValue> = {}
            for (const column of dataset.columns) row[column] = null
            return { ...dataset, rows: [...dataset.rows, row] }
          }),
        }
      }),
    )
  }

  function handleUpdateCell(
    datasetId: string,
    rowIndex: number,
    column: string,
    value: CellValue,
  ) {
    setFiles((previous) =>
      previous.map((file) => {
        if (!file.datasets.some((dataset) => dataset.id === datasetId)) {
          return file
        }
        return {
          ...file,
          datasets: file.datasets.map((dataset) => {
            if (dataset.id !== datasetId) return dataset
            if (rowIndex < 0 || rowIndex >= dataset.rows.length) return dataset
            const rows = dataset.rows.slice()
            rows[rowIndex] = { ...rows[rowIndex], [column]: value }
            return { ...dataset, rows }
          }),
        }
      }),
    )
  }

  function handleDeleteRow(datasetId: string, rowIndex: number) {
    setFiles((previous) =>
      previous.map((file) => {
        if (!file.datasets.some((dataset) => dataset.id === datasetId)) {
          return file
        }
        return {
          ...file,
          datasets: file.datasets.map((dataset) => {
            if (dataset.id !== datasetId) return dataset
            if (rowIndex < 0 || rowIndex >= dataset.rows.length) return dataset
            return {
              ...dataset,
              rows: dataset.rows.filter((_, index) => index !== rowIndex),
            }
          }),
        }
      }),
    )
  }

  function handleCreateRelationship(
    fromDatasetId: string,
    fromColumn: string,
    toDatasetId: string,
    toColumn: string,
    linkingSide: 'from' | 'to',
  ) {
    const fromDataset = datasetsById.get(fromDatasetId)
    const toDataset = datasetsById.get(toDatasetId)
    if (!fromDataset || !toDataset) return

    const id = `${fromDatasetId}:${fromColumn}->${toDatasetId}:${toColumn}`
    if (relationships.some((relationship) => relationship.id === id)) return

    setRelationships((previous) => [
      ...previous,
      {
        id,
        from: fromDataset,
        to: toDataset,
        fromColumn,
        toColumn,
        cardinality: 'many-to-one',
        fromDistinct: 0,
        toDistinct: 0,
        fromUnique: false,
        toUnique: false,
        toHasNulls: false,
        linkingSide,
      },
    ])
    pushToast(
      `Connected ${fromDataset.label}.${fromColumn} → ${toDataset.label}.${toColumn}`,
      'success',
    )
  }

  function handleDeleteRelationship(relationshipId: string) {
    setRelationships((previous) =>
      previous.filter((relationship) => relationship.id !== relationshipId),
    )
  }

  function handleAcceptRelationship(candidate: RelationshipCandidate) {
    const already = relationships.some(
      (relationship) => relationship.id === candidate.id,
    )
    if (!already) {
      setRelationships((previous) => [...previous, candidate])
      pushToast(
        `Saved relation: ${candidate.from.label}.${candidate.fromColumn} → ${candidate.to.label}.${candidate.toColumn}`,
        'success',
      )
    }
  }

  function handleOpenDataset(datasetId: string) {
    setSelectedDatasetId(datasetId)
    setRestoredView(null)
    setDataFocus(null)
    setNavigationHistory([])
    setActiveTab('data')
    setSidebarOpen(false)
  }

  function handleSaveView(view: Omit<SavedDataView, 'id'>) {
    const saved: SavedDataView = { ...view, id: crypto.randomUUID() }
    setSavedViews((previous) => [...previous, saved])
    pushToast(`Saved view: ${saved.name}`, 'success')
  }

  function handleOpenSavedView(viewId: string) {
    const saved = savedViews.find((view) => view.id === viewId)
    if (!saved) return
    if (!datasetsById.has(saved.datasetId)) {
      pushToast('This saved view references a missing sheet', 'error')
      return
    }

    viewNonceRef.current += 1
    setSelectedDatasetId(saved.datasetId)
    setRestoredView({ view: saved, nonce: viewNonceRef.current })
    setDataFocus(null)
    setNavigationHistory([])
    setActiveTab('data')
    setView('workspace')
    setSidebarOpen(false)
  }

  function handleDeleteSavedView(viewId: string) {
    setSavedViews((previous) =>
      previous.filter((view) => view.id !== viewId),
    )
    setRestoredView((previous) =>
      previous?.view.id === viewId ? null : previous,
    )
  }

  function handleImportWorkspace(snapshot: WorkspaceSnapshot) {
    setFiles(snapshot.files)
    setRelationships(snapshot.relationships)
    setSavedViews(snapshot.savedViews)
    setExpandedFileIds(new Set(snapshot.files.map((file) => file.id)))
    setSelectedDatasetId(
      snapshot.files[0]?.datasets[0]?.id ?? null,
    )
    setRestoredView(null)
    setDataFocus(null)
    setNavigationHistory([])
    setActiveTab('info')
    setView('workspace')
    setCompareMode(false)
    setCompareIds([])
    setPending(null)
    setPendingReload(null)
    setReloadingDatasetId(null)
    setVaultOpen(false)
    setSidebarOpen(false)

    const datasetCount = snapshot.files.reduce(
      (total, file) => total + file.datasets.length,
      0,
    )
    pushToast(
      `Imported ${snapshot.files.length} file${
        snapshot.files.length === 1 ? '' : 's'
      } and ${datasetCount} dataset${datasetCount === 1 ? '' : 's'}`,
      'success',
    )
  }

  function handleNavigateToRelatedRow(link: ForeignKeyLink, value: CellValue) {
    focusNonceRef.current += 1
    setRestoredView(null)

    setNavigationHistory((previous) => [
      ...previous,
      {
        datasetId: selectedDatasetId,
        tab: activeTab,
        focus: dataFocus,
      },
    ])
    setDataFocus({
      datasetId: link.targetDatasetId,
      column: link.targetColumn,
      value,
      sourceLabel: selectedDataset?.label ?? 'linked sheet',
      sourceColumn: link.column,
      nonce: focusNonceRef.current,
    })
    setSelectedDatasetId(link.targetDatasetId)
    setActiveTab('data')
    setSidebarOpen(false)
  }

  function handleNavigateBack() {
    const previous = navigationHistory[navigationHistory.length - 1]
    if (!previous) return

    setNavigationHistory(navigationHistory.slice(0, -1))
    setSelectedDatasetId(previous.datasetId)
    setRestoredView(null)
    setActiveTab(previous.tab)
    setDataFocus(previous.focus)
    setView('workspace')
    setSidebarOpen(false)
  }

  function handleDeleteFile(fileId: string) {
    const target = files.find((file) => file.id === fileId)
    if (!target) return

    const remainingFiles = files.filter((file) => file.id !== fileId)
    setFiles(remainingFiles)
    setExpandedFileIds((previous) => {
      const next = new Set(previous)
      next.delete(fileId)
      return next
    })

    const remainingDatasetCount = remainingFiles.reduce(
      (total, file) => total + file.datasets.length,
      0,
    )

    if (remainingDatasetCount < 2) {
      setCompareMode(false)
      setCompareIds([])
    } else {
      const removedIds = new Set(target.datasets.map((dataset) => dataset.id))
      setCompareIds((previous) =>
        previous.filter((id) => !removedIds.has(id)),
      )
    }

    setDataFocus(null)
    setNavigationHistory([])

    const targetDatasetIds = new Set(
      target.datasets.map((dataset) => dataset.id),
    )
    setSavedViews((previous) =>
      previous.filter((view) => !targetDatasetIds.has(view.datasetId)),
    )
    setRestoredView((previous) =>
      previous && targetDatasetIds.has(previous.view.datasetId)
        ? null
        : previous,
    )
    setRelationships((previous) =>
      previous.filter(
        (relationship) =>
          !targetDatasetIds.has(relationship.from.id) &&
          !targetDatasetIds.has(relationship.to.id),
      ),
    )

    if (target.datasets.some((dataset) => dataset.id === selectedDatasetId)) {
      const nextDataset = remainingFiles.flatMap((file) => file.datasets)[0]
      setSelectedDatasetId(nextDataset?.id ?? null)
      if (!nextDataset) setActiveTab('info')
    }

    pushToast(`${target.name} removed`, 'info')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        files={files}
        selectedDatasetId={selectedDatasetId}
        expandedFileIds={expandedFileIds}
        open={sidebarOpen}
        desktopVisible={sidebarVisible}
        onHide={() => setSidebarVisible(false)}
        compareMode={compareMode}
        compareIds={compareIds}
        savedViews={savedViews}
        onClose={() => setSidebarOpen(false)}
        onToggleFile={handleToggleFile}
        onSelectDataset={handleSelectDataset}
        onDeleteFile={handleDeleteFile}
        onToggleCompareMode={handleToggleCompareMode}
        onToggleCompareDataset={handleToggleCompareDataset}
        onClearCompare={handleClearCompare}
        onOpenSavedView={handleOpenSavedView}
        onDeleteSavedView={handleDeleteSavedView}
        reloadingDatasetId={reloadingDatasetId}
        onReloadDataset={handleReloadDataset}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden"
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {!sidebarVisible && (
            <button
              type="button"
              onClick={() => setSidebarVisible(true)}
              className="hidden shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:inline-flex"
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}

          {selectedDataset ? (
            <div className="flex min-w-0 items-center gap-2">
              {navigationHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label={`Back to ${backDataset?.label ?? 'previous view'}`}
                  title={`Back to ${backDataset?.label ?? 'previous view'}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="max-w-[180px] truncate">
                    {selectedDataset.fileName}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="max-w-[140px] truncate">
                    {selectedDataset.sheetName}
                  </span>
                </div>
                <h2 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDataset.label}
                </h2>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Workspace
              </p>
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                Overview
              </h2>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {files.length > 0 && (
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex">
                {formatInteger(totalDatasets)} dataset
                {totalDatasets === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={
                theme === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'
              }
              title={
                theme === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'
              }
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setView((previous) =>
                  previous === 'workspace' ? 'designer' : 'workspace',
                )
              }
              className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                view === 'designer'
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
              }`}
              aria-label="Relations Designer"
              title="Relations Designer"
            >
              <Cable className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600 active:scale-[0.99]"
              aria-label="Add file"
              title="Add file"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setVaultOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Workspace vault"
              title="Workspace vault"
            >
              <Vault className="h-4 w-4" />
            </button>
          </div>
        </header>

        {view === 'designer' ? (
          <main className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
            <RelationsDesigner
              datasets={files.flatMap((file) => file.datasets)}
              relationships={relationships}
              onCreateRelationship={handleCreateRelationship}
              onDeleteRelationship={handleDeleteRelationship}
              onAddColumn={handleAddColumn}
              onCreateEntity={handleCreateEntity}
              onBack={() => setView('workspace')}
            />
          </main>
        ) : selectedDataset ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setView('workspace')
                    setActiveTab('info')
                  }}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                    activeTab === 'info'
                      ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Info className="h-4 w-4" />
                  Info
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('workspace')
                    setActiveTab('data')
                  }}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                    activeTab === 'data'
                      ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Table2 className="h-4 w-4" />
                  Data
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {formatInteger(selectedDataset.rows.length)}
                  </span>
                </button>
                {relationships.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('workspace')
                      setActiveTab('relations')
                    }}
                    className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                      activeTab === 'relations'
                        ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    Relations
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                      relationships.length > 0
                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                      >
                      {formatInteger(relationships.length)}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <main className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === 'info' ? (
                <InfoTab dataset={selectedDataset} theme={theme} />
              ) : activeTab === 'data' ? (
                <DataTab
                  key={`${selectedDataset.id}:${activeRestoredView?.nonce ?? 'default'}`}
                  dataset={selectedDataset}
                  foreignKeyLinks={foreignKeyLinks}
                  joinedTables={selectedDatasetJoins}
                  savedView={activeRestoredView?.view ?? null}
                  onSaveView={handleSaveView}
                  focus={dataFocus}
                  onNavigateToRelatedRow={handleNavigateToRelatedRow}
                  onNavigateBack={handleNavigateBack}
                  canNavigateBack={navigationHistory.length > 0}
                  onClearFocus={() => setDataFocus(null)}
                  editable={selectedDataset.fileKind === 'manual'}
                  onAddRow={() => handleAddRow(selectedDataset.id)}
                  onUpdateCell={(rowIndex, column, value) =>
                    handleUpdateCell(
                      selectedDataset.id,
                      rowIndex,
                      column,
                      value,
                    )
                  }
                  onDeleteRow={(rowIndex) =>
                    handleDeleteRow(selectedDataset.id, rowIndex)
                  }
                />
              ) : activeTab === 'relations' && relationships.length > 0 ? (
                <RelationsTab
                  relationships={relationships}
                  selectedDatasetId={selectedDatasetId}
                  onOpenDataset={handleOpenDataset}
                />
              ) : null}
            </main>
          </>
        ) : (
          <main className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
              <div className="text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-indigo-400 dark:ring-slate-800">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  Turn spreadsheets into a workspace
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Upload a CSV or Excel workbook. Every sheet is parsed into
                  its own dataset, labelled the way you want, and ready to
                  inspect.
                </p>
              </div>

              <div className="mt-8">
                <UploadZone
                  loading={loading}
                  onFiles={(incoming) => void handleFiles(incoming)}
                  onBrowse={openFilePicker}
                />
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Feature
                  icon={Layers}
                  title="Multi-sheet ready"
                  text="Each worksheet becomes a separate, labelled dataset."
                />
                <Feature
                  icon={Gauge}
                  title="Instant metadata"
                  text="Types, missing values and ranges computed on upload."
                />
                <Feature
                  icon={Tags}
                  title="Your labels"
                  text="Name every dataset so the sidebar stays yours."
                />
              </div>
            </div>
          </main>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        multiple
        className="hidden"
        onChange={(event) => {
          const incoming = event.target.files
          if (incoming && incoming.length > 0) {
            void handleFiles(Array.from(incoming))
          }
          event.target.value = ''
        }}
      />

      {pending && (
        <LabelModal
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={({ labels, idColumns, addIdColumns }) =>
            handleConfirmLabels(labels, idColumns, addIdColumns)
          }
        />
      )}

      {vaultOpen && (
        <VaultModal
          onClose={() => setVaultOpen(false)}
          onImport={handleImportWorkspace}
        />
      )}

      {compareMode && firstCompare && secondCompare && (
        <RelationshipModal
          first={firstCompare}
          second={secondCompare}
          candidates={compareCandidates}
          acceptedRelationships={relationships}
          onAccept={handleAcceptRelationship}
          onClose={handleClearCompare}
        />
      )}

      <Toasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((previous) =>
            previous.filter((toast) => toast.id !== id),
          )
        }
      />
    </div>
  )
}

export default App
