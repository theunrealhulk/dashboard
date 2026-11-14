import { useState } from 'react'
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  PanelLeftClose,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Dataset, SavedDataView, UploadedFile } from '../types'
import { formatBytes, formatInteger } from '../lib/format'

interface SidebarProps {
  files: UploadedFile[]
  selectedDatasetId: string | null
  expandedFileIds: Set<string>
  open: boolean
  desktopVisible: boolean
  onHide: () => void
  compareMode: boolean
  compareIds: string[]
  savedViews: SavedDataView[]
  reloadingDatasetId: string | null
  onClose: () => void
  onToggleFile: (fileId: string) => void
  onSelectDataset: (datasetId: string) => void
  onDeleteFile: (fileId: string) => void
  onToggleCompareMode: () => void
  onToggleCompareDataset: (datasetId: string) => void
  onClearCompare: () => void
  onOpenSavedView: (viewId: string) => void
  onDeleteSavedView: (viewId: string) => void
  onReloadDataset: (datasetId: string) => void
}

interface SheetRowProps {
  dataset: Dataset
  compareMode: boolean
  selected: boolean
  picked: boolean
  reloading: boolean
  canReload?: boolean
  title: string
  icon?: LucideIcon
  secondary?: string
  onActivate: () => void
  onReload: () => void
  onDelete?: () => void
  deleteTitle?: string
  className?: string
}

function SheetRow({
  dataset,
  compareMode,
  selected,
  picked,
  reloading,
  canReload = true,
  title,
  icon: Icon,
  secondary,
  onActivate,
  onReload,
  onDelete,
  deleteTitle,
  className = '',
}: SheetRowProps) {
  const active = compareMode ? picked : selected

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      title={
        compareMode
          ? picked
            ? `Remove ${dataset.label} from comparison`
            : `Compare ${dataset.label}`
          : title
      }
      className={`group/sheet flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
      } ${className}`}
    >
      {compareMode ? (
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
            picked
              ? 'border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400'
              : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          {picked && <Check className="h-2.5 w-2.5" />}
        </span>
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            selected
              ? 'bg-indigo-500 dark:bg-indigo-400'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      )}
      {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{dataset.label}</span>
        {secondary && (
          <span className="block truncate text-[10px] text-slate-500">
            {secondary}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
        {formatInteger(dataset.rows.length)}
      </span>
      {canReload && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onReload()
          }}
          disabled={reloading}
          title={reloading ? 'Reloading sheet...' : 'Reload sheet'}
          aria-label="Reload sheet"
          className={`shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200 ${
            reloading ? 'text-indigo-500 dark:text-indigo-400' : ''
          }`}
        >
          <RefreshCw className={`h-3 w-3 ${reloading ? 'animate-spin' : ''}`} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 group-hover/sheet:opacity-100"
          aria-label={deleteTitle}
          title={deleteTitle}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

interface ListSearchProps {
  value: string
  placeholder: string
  label: string
  onChange: (value: string) => void
}

function ListSearch({ value, placeholder, label, onChange }: ListSearchProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-400/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-indigo-400/40 dark:focus:bg-white/[0.07]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()}`}
          title={`Clear ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  count: number
  collapsed: boolean
  onToggle: () => void
  className?: string
}

function SectionHeader({
  title,
  count,
  collapsed,
  onToggle,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-300"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {title}
        </span>
      </button>
      <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-white/5 dark:text-slate-400">
        {count}
      </span>
    </div>
  )
}

export function Sidebar({
  files,
  selectedDatasetId,
  expandedFileIds,
  open,
  desktopVisible,
  onHide,
  compareMode,
  compareIds,
  savedViews,
  reloadingDatasetId,
  onClose,
  onToggleFile,
  onSelectDataset,
  onDeleteFile,
  onToggleCompareDataset,
  onClearCompare,
  onOpenSavedView,
  onDeleteSavedView,
  onReloadDataset,
}: SidebarProps) {
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [viewsCollapsed, setViewsCollapsed] = useState(false)
  const [query, setQuery] = useState('')

  const datasetCount = files.reduce(
    (total, file) => total + file.datasets.length,
    0,
  )

  const datasetsById = new Map(
    files.flatMap((file) =>
      file.datasets.map((dataset) => [dataset.id, dataset] as const),
    ),
  )
  const compareDatasets = compareIds
    .map((id) => datasetsById.get(id))
    .filter((dataset) => dataset !== undefined)

  const showSearch = files.length + savedViews.length >= 6
  const normalizedQuery = showSearch ? query.trim().toLowerCase() : ''

  const datasetMatchesQuery = (dataset: Dataset) =>
    normalizedQuery !== '' &&
    (dataset.label.toLowerCase().includes(normalizedQuery) ||
      dataset.sheetName.toLowerCase().includes(normalizedQuery))

  const visibleFiles = files.filter(
    (file) =>
      normalizedQuery === '' ||
      file.name.toLowerCase().includes(normalizedQuery) ||
      file.datasets.some(datasetMatchesQuery),
  )

  const visibleSavedViews = savedViews.filter((view) => {
    if (normalizedQuery === '') return true
    const target = datasetsById.get(view.datasetId)
    return (
      view.name.toLowerCase().includes(normalizedQuery) ||
      (target?.label.toLowerCase().includes(normalizedQuery) ?? false) ||
      (target?.sheetName.toLowerCase().includes(normalizedQuery) ?? false)
    )
  })

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-white/5 dark:bg-slate-950 lg:static lg:translate-x-0 ${
          desktopVisible ? '' : 'lg:hidden'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-4 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Database className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              Data Desk
            </h1>
            <p className="text-[11px] text-slate-500">CSV &amp; XLSX explorer</p>
          </div>
          <button
            type="button"
            onClick={onHide}
            className="ml-auto hidden rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white lg:inline-flex"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showSearch && (
          <div className="mt-4 px-4">
            <ListSearch
              value={query}
              onChange={setQuery}
              placeholder="Search files, sheets, and views..."
              label="Search workspace"
            />
          </div>
        )}

        <SectionHeader
          title="Uploaded files"
          count={files.length}
          collapsed={filesCollapsed}
          onToggle={() => setFilesCollapsed((value) => !value)}
          className={`${showSearch ? 'mt-4' : 'mt-6'} px-2`}
        />

        {compareMode && (
          <div className="mx-2 mt-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
                Pick two sheets
              </p>
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                {compareIds.length}/2
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {[0, 1].map((index) => {
                const dataset = compareDatasets[index]
                if (!dataset) {
                  return (
                    <div
                      key={`slot-${index}`}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-2 py-1 text-[11px] text-indigo-500 dark:border-indigo-400/20 dark:text-indigo-300/60"
                    >
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-indigo-300 text-[8px] font-semibold dark:border-indigo-400/30">
                        {index + 1}
                      </span>
                      Select a sheet
                    </div>
                  )
                }

                return (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => onToggleCompareDataset(dataset.id)}
                    className="flex w-full items-center gap-1.5 rounded-lg bg-indigo-100 px-2 py-1 text-left text-[11px] text-indigo-700 transition hover:bg-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/25"
                    title={`Remove ${dataset.label} from comparison`}
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {dataset.label}
                    </span>
                    <X className="h-3 w-3 shrink-0 text-indigo-500 dark:text-indigo-300" />
                  </button>
                )
              })}
            </div>
            {compareIds.length > 0 && (
              <button
                type="button"
                onClick={onClearCompare}
                className="mt-2 text-[10px] font-medium text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100"
              >
                Clear selection
              </button>
            )}
          </div>
        )}

        <nav className="scrollbar-thin mt-2 flex-1 overflow-y-auto px-2 pb-4">
          {!filesCollapsed && (
            <>
              {files.length === 0 ? (
                <div className="mx-2 mt-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-3 py-6 text-center">
                  <FileSpreadsheet className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-600" />
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    No files yet
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-600">
                    Upload a CSV or Excel file to start exploring.
                  </p>
                </div>
              ) : visibleFiles.length === 0 ? (
                <div className="mx-2 mt-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-3 py-6 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-600" />
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    No files found
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-600">
                    Nothing matches &ldquo;{query.trim()}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-2 text-[10px] font-medium text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                visibleFiles.map((file) => {
                  const fileMatchesQuery =
                    normalizedQuery !== '' &&
                    file.name.toLowerCase().includes(normalizedQuery)
                  const matchingDatasets =
                    file.datasets.filter(datasetMatchesQuery)
                  const forcedExpand =
                    normalizedQuery !== '' &&
                    !fileMatchesQuery &&
                    matchingDatasets.length > 0
                  const visibleDatasets =
                    normalizedQuery !== '' && !fileMatchesQuery
                      ? matchingDatasets
                      : file.datasets
                  const expanded =
                    expandedFileIds.has(file.id) || forcedExpand
                  const FileIcon =
                    file.kind === 'manual'
                      ? Table2
                      : file.kind === 'csv'
                        ? FileText
                        : FileSpreadsheet
                  const flatDataset =
                    file.datasets.length <= 1 ? file.datasets[0] : undefined

                  if (flatDataset) {
                    return (
                      <SheetRow
                        key={file.id}
                        dataset={flatDataset}
                        compareMode={compareMode}
                        selected={flatDataset.id === selectedDatasetId}
                        picked={compareIds.includes(flatDataset.id)}
                        reloading={reloadingDatasetId === flatDataset.id}
                        canReload={
                          file.kind !== 'manual' &&
                          file.sourceFile !== undefined
                        }
                        title={file.name}
                        icon={FileIcon}
                        secondary={
                          file.kind === 'manual'
                            ? 'Manual entity'
                            : `${file.name} · ${formatBytes(file.size)}`
                        }
                        onActivate={() =>
                          compareMode
                            ? onToggleCompareDataset(flatDataset.id)
                            : onSelectDataset(flatDataset.id)
                        }
                        onReload={() => onReloadDataset(flatDataset.id)}
                        onDelete={() => onDeleteFile(file.id)}
                        deleteTitle={`Remove ${file.name}`}
                        className="mb-0.5"
                      />
                    )
                  }

                  return (
                    <div key={file.id} className="group/file mb-1">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onToggleFile(file.id)}
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-300"
                          aria-label={
                            expanded ? 'Collapse file' : 'Expand file'
                          }
                          title={expanded ? 'Collapse file' : 'Expand file'}
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (compareMode) {
                              onToggleFile(file.id)
                              return
                            }
                            const firstDataset = file.datasets[0]
                            if (firstDataset) onSelectDataset(firstDataset.id)
                            if (!expanded) onToggleFile(file.id)
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                          <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                              {file.name}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {formatBytes(file.size)} ·{' '}
                              {file.datasets.length} dataset
                              {file.datasets.length === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFile(file.id)}
                          className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 group-hover/file:opacity-100"
                          aria-label={`Remove ${file.name}`}
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {expanded && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 dark:border-white/5">
                          {visibleDatasets.map((dataset) => (
                            <SheetRow
                              key={dataset.id}
                              dataset={dataset}
                              compareMode={compareMode}
                              selected={dataset.id === selectedDatasetId}
                              picked={compareIds.includes(dataset.id)}
                              reloading={reloadingDatasetId === dataset.id}
                              canReload={
                                file.kind !== 'manual' &&
                                file.sourceFile !== undefined
                              }
                              title={dataset.sheetName}
                              onActivate={() =>
                                compareMode
                                  ? onToggleCompareDataset(dataset.id)
                                  : onSelectDataset(dataset.id)
                              }
                              onReload={() => onReloadDataset(dataset.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}

          {savedViews.length > 0 && (
            <div className="mt-4">
              <SectionHeader
                title="Saved views"
                count={savedViews.length}
                collapsed={viewsCollapsed}
                onToggle={() => setViewsCollapsed((value) => !value)}
              />
              {!viewsCollapsed && (
                <>
                  {visibleSavedViews.length === 0 ? (
                    <div className="mx-2 mt-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-3 py-6 text-center">
                      <Search className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-600" />
                      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        No saved views found
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-600">
                        Nothing matches &ldquo;{query.trim()}&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="mt-2 text-[10px] font-medium text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-0.5">
                      {visibleSavedViews.map((view) => {
                        const target = datasetsById.get(view.datasetId)
                        return (
                          <div
                            key={view.id}
                            className="group/view flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => onOpenSavedView(view.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              title={`Open ${view.name}`}
                            >
                              <Bookmark className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">
                                  {view.name}
                                </span>
                                <span className="block truncate text-[10px] text-slate-500">
                                  {target?.label ?? 'Missing sheet'}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSavedView(view.id)}
                              className="rounded p-1 text-slate-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 group-hover/view:opacity-100"
                              aria-label={`Delete ${view.name}`}
                              title={`Delete ${view.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-white/5">
          <p className="text-[11px] text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">{datasetCount}</span>{' '}
            dataset{datasetCount === 1 ? '' : 's'} across{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">{files.length}</span>{' '}
            file{files.length === 1 ? '' : 's'}
          </p>
        </div>
      </aside>
    </>
  )
}
