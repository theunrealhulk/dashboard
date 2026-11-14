import { Check, Plus, Table2, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ColumnType, EntityColumn } from '../types'

interface NewEntityModalProps {
  onCancel: () => void
  onCreate: (label: string, columns: EntityColumn[]) => void
}

const TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
]

export function NewEntityModal({ onCancel, onCreate }: NewEntityModalProps) {
  const [label, setLabel] = useState('')
  const [columns, setColumns] = useState<EntityColumn[]>([
    { name: 'ID', type: 'number' },
  ])

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

  const trimmedLabel = label.trim()
  const trimmedColumns = columns.map((column) => ({
    name: column.name.trim(),
    type: column.type,
  }))
  const seen = new Set<string>()
  let duplicate = false
  for (const column of trimmedColumns) {
    const key = column.name.toLowerCase()
    if (key !== '' && seen.has(key)) duplicate = true
    seen.add(key)
  }
  const hasEmptyColumn = trimmedColumns.some((column) => column.name === '')
  const canCreate =
    trimmedLabel.length > 0 &&
    trimmedColumns.length > 0 &&
    !hasEmptyColumn &&
    !duplicate

  function addColumn() {
    setColumns((previous) => {
      let index = previous.length + 1
      const existing = new Set(
        previous.map((column) => column.name.trim().toLowerCase()),
      )
      while (existing.has(`column ${index}`)) index += 1
      return [...previous, { name: `Column ${index}`, type: 'text' }]
    })
  }

  function removeColumn(index: number) {
    setColumns((previous) =>
      previous.filter((_, columnIndex) => columnIndex !== index),
    )
  }

  function updateColumnName(index: number, name: string) {
    setColumns((previous) =>
      previous.map((column, columnIndex) =>
        columnIndex === index ? { ...column, name } : column,
      ),
    )
  }

  function updateColumnType(index: number, type: ColumnType) {
    setColumns((previous) =>
      previous.map((column, columnIndex) =>
        columnIndex === index ? { ...column, type } : column,
      ),
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    onCreate(trimmedLabel, trimmedColumns)
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
        aria-labelledby="new-entity-title"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            <Table2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="new-entity-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              New entity
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Create a table without a file, then fill it in the Data tab.
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
          <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label
                htmlFor="entity-label"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Entity name
              </label>
              <input
                id="entity-label"
                type="text"
                value={label}
                autoFocus
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Customers"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Columns
                </p>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {columns.length} total
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span className="min-w-0 flex-1">Name</span>
                <span className="w-28">Type</span>
                <span className="w-8" />
              </div>
              <div className="mt-1 space-y-2">
                {columns.map((column, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={column.name}
                      onChange={(event) =>
                        updateColumnName(index, event.target.value)
                      }
                      placeholder="Column name"
                      aria-label={`Column ${index + 1} name`}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                    />
                    <select
                      value={column.type}
                      onChange={(event) =>
                        updateColumnType(
                          index,
                          event.target.value as ColumnType,
                        )
                      }
                      aria-label={`Column ${index + 1} type`}
                      className="w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      aria-label={`Remove ${column.name || 'column'}`}
                      title="Remove column"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addColumn}
                className="mt-2 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Add column"
                title="Add column"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {hasEmptyColumn && (
                <p className="mt-2 text-xs text-rose-500">
                  Column names cannot be empty.
                </p>
              )}
              {duplicate && (
                <p className="mt-2 text-xs text-rose-500">
                  Column names must be unique.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {canCreate
                ? 'Ready to create. Add rows in the Data tab.'
                : 'Give the entity a name and at least one column.'}
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
                disabled={!canCreate}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Create entity"
                title="Create entity"
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
