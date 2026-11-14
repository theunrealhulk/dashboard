import {
  Check,
  FileSpreadsheet,
  FileText,
  Tags,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ParsedDataset, ParsedFile } from '../types'
import { formatBytes, formatInteger, kindLabel } from '../lib/format'
import { isBlank } from '../lib/values'

interface LabelModalProps {
  pending: ParsedFile[]
  onCancel: () => void
  onConfirm: (result: {
    labels: Record<string, string>
    idColumns: Record<string, string>
    addIdColumns: Record<string, boolean>
  }) => void
}

export function LabelModal({ pending, onCancel, onConfirm }: LabelModalProps) {
  const [labels, setLabels] = useState<Record<string, string>>(() => {
    const entries = pending.flatMap((file) =>
      file.datasets.map(
        (dataset) => [dataset.tempId, dataset.defaultLabel] as const,
      ),
    )
    return Object.fromEntries(entries)
  })
  const [requireUniqueId, setRequireUniqueId] = useState<Record<string, boolean>>(
    () => {
      const entries = pending.flatMap((file) =>
        file.datasets.map((dataset) => [dataset.tempId, true] as const),
      )
      return Object.fromEntries(entries)
    },
  )
  const [idColumn, setIdColumn] = useState<Record<string, string>>({})
  const [addIdColumn, setAddIdColumn] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const totalDatasets = pending.reduce(
    (total, file) => total + file.datasets.length,
    0,
  )

  function uniqueColumns(dataset: ParsedDataset): string[] {
    return dataset.columns.filter((column) => {
      const seen = new Set<string>()
      for (const row of dataset.rows) {
        const value = row[column]
        if (isBlank(value)) continue
        const key = value instanceof Date ? value.toISOString() : String(value)
        if (seen.has(key)) return false
        seen.add(key)
      }
      return true
    })
  }

  useEffect(() => {
    const next = { ...idColumn }
    for (const file of pending) {
      for (const dataset of file.datasets) {
        if (requireUniqueId[dataset.tempId] && !next[dataset.tempId]) {
          const firstUnique = uniqueColumns(dataset)[0]
          if (firstUnique) next[dataset.tempId] = firstUnique
        }
      }
    }
    setIdColumn(next)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allValid = pending.every((file) =>
    file.datasets.every((dataset) => {
      const label = (labels[dataset.tempId] ?? '').trim()
      if (!label) return false
      if (requireUniqueId[dataset.tempId] && !idColumn[dataset.tempId]) {
        return false
      }
      return true
    }),
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allValid) return
    const trimmed = Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [key, value.trim()]),
    )
    onConfirm({
      labels: trimmed,
      idColumns: idColumn,
      addIdColumns: addIdColumn,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-modal-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            <Tags className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="label-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Label your data
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Give every sheet a name so it is easy to find in the sidebar.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {pending.map((file, fileIndex) => {
              const FileIcon =
                file.kind === 'csv' ? FileText : FileSpreadsheet
              return (
                <div
                  key={`${file.file.name}-${fileIndex}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                      <FileIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {kindLabel(file.kind)} · {formatBytes(file.file.size)} ·{' '}
                        {file.datasets.length} dataset
                        {file.datasets.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {file.datasets.map((dataset, index) => {
                      const value = labels[dataset.tempId] ?? ''
                      const invalid = value.trim() === ''
                      const requireChecked = requireUniqueId[dataset.tempId] === true
                      const addChecked = addIdColumn[dataset.tempId] === true
                      const columns = uniqueColumns(dataset)

                      return (
                        <div
                          key={dataset.tempId}
                          className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <label
                              htmlFor={`label-${dataset.tempId}`}
                              className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                            >
                              Label
                              {file.kind !== 'csv' && (
                                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {dataset.sheetName}
                                </span>
                              )}
                            </label>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {formatInteger(dataset.rows.length)} rows ·{' '}
                              {formatInteger(dataset.columns.length)} columns
                            </span>
                          </div>
                          <input
                            id={`label-${dataset.tempId}`}
                            type="text"
                            value={value}
                            autoFocus={index === 0 && file === pending[0]}
                            onChange={(event) =>
                              setLabels((previous) => ({
                                ...previous,
                                [dataset.tempId]: event.target.value,
                              }))
                            }
                            placeholder="Dataset label"
                            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 ${
                              invalid
                                ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:border-rose-500 dark:focus:ring-rose-500/20'
                                : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20'
                            }`}
                          />

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              <input
                                type="checkbox"
                                checked={requireChecked}
                                onChange={() => {
                                  const next = !requireChecked
                                  setRequireUniqueId((previous) => ({
                                    ...previous,
                                    [dataset.tempId]: next,
                                  }))
                                  if (next && !idColumn[dataset.tempId]) {
                                    const firstUnique = columns.find((column) => {
                                      const seen = new Set<string>()
                                      let unique = true
                                      for (const row of dataset.rows) {
                                        const value = row[column]
                                        if (isBlank(value)) continue
                                        const key =
                                          value instanceof Date
                                            ? value.toISOString()
                                            : String(value)
                                        if (seen.has(key)) {
                                          unique = false
                                          break
                                        }
                                        seen.add(key)
                                      }
                                      return unique
                                    })
                                    if (firstUnique) {
                                      setIdColumn((previous) => ({
                                        ...previous,
                                        [dataset.tempId]: firstUnique,
                                      }))
                                    }
                                  }
                                }}
                                className="rounded border-slate-300 bg-slate-50 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-indigo-400 dark:focus:ring-indigo-500"
                              />
                              Require unique identifier?
                            </label>
                            {requireChecked && (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  ID column:
                                </span>
                                <select
                                  value={idColumn[dataset.tempId] ?? ''}
                                  onChange={(event) =>
                                    setIdColumn((previous) => ({
                                      ...previous,
                                      [dataset.tempId]: event.target.value,
                                    }))
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                  <option value="">
                                    Select column
                                  </option>
                                  {columns.map((column) => (
                                    <option key={column} value={column}>
                                      {column}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              <input
                                type="checkbox"
                                checked={addChecked}
                                onChange={() => {
                                  const next = !addChecked
                                  setAddIdColumn((previous) => ({
                                    ...previous,
                                    [dataset.tempId]: next,
                                  }))
                                  if (next) {
                                    setIdColumn((previous) => ({
                                      ...previous,
                                      [dataset.tempId]: 'ID',
                                    }))
                                  } else if (idColumn[dataset.tempId] === 'ID') {
                                    setIdColumn((previous) => {
                                      const nextColumns = { ...previous }
                                      delete nextColumns[dataset.tempId]
                                      return nextColumns
                                    })
                                  }
                                }}
                                className="rounded border-slate-300 bg-slate-50 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-indigo-400 dark:focus:ring-indigo-500"
                              />
                              Add ID column?
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {allValid
                ? `${totalDatasets} dataset${totalDatasets === 1 ? '' : 's'} ready`
                : 'Every dataset needs a label.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!allValid}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Add ${totalDatasets} dataset${totalDatasets === 1 ? '' : 's'}`}
                title={`Add ${totalDatasets} dataset${totalDatasets === 1 ? '' : 's'}`}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
