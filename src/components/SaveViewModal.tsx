import { Bookmark, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface SaveViewModalProps {
  onCancel: () => void
  onConfirm: (name: string) => void
}

export function SaveViewModal({ onCancel, onConfirm }: SaveViewModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmedName = name.trim()

  useEffect(() => {
    inputRef.current?.focus()
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmedName) return
    onConfirm(trimmedName)
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
        aria-labelledby="save-view-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            <Bookmark className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="save-view-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Save current view
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Save the current filters, sorting, columns, and joins.
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

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <label
            htmlFor="save-view-name"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            View name
          </label>
          <input
            ref={inputRef}
            id="save-view-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Active customers"
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmedName}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save view
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
