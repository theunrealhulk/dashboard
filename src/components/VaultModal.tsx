import {
  AlertTriangle,
  Download,
  FileJson,
  Upload,
  Vault,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { WorkspaceSnapshot } from '../lib/workspaceStorage'
import {
  parseWorkspaceJson,
  readWorkspaceStorage,
  WORKSPACE_STORAGE_KEY,
} from '../lib/workspaceStorage'
import { formatBytes, formatInteger } from '../lib/format'

interface VaultModalProps {
  onClose: () => void
  onImport: (snapshot: WorkspaceSnapshot) => void
}

export function VaultModal({ onClose, onImport }: VaultModalProps) {
  const [stored] = useState(() => readWorkspaceStorage())
  const [error, setError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const snapshot = stored?.snapshot
  const datasetCount =
    snapshot?.files.reduce(
      (total, file) => total + file.datasets.length,
      0,
    ) ?? 0
  const relationshipCount = snapshot?.relationships.length ?? 0
  const savedViewCount = snapshot?.savedViews.length ?? 0

  function handleExport() {
    if (!stored) return
    const blob = new Blob([stored.raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `data-desk-vault-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const imported = parseWorkspaceJson(text)
      const confirmed = window.confirm(
        'Importing this workspace will replace the current files, relationships, and saved views. Continue?',
      )
      if (!confirmed) return
      onImport(imported)
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Could not import this workspace.',
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-modal-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            <Vault className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="vault-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Workspace vault
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Files, relationships, and saved views stored in this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stored && snapshot ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Last saved{' '}
                    {stored.savedAt
                      ? new Date(stored.savedAt).toLocaleString()
                      : 'unknown'}
                  </span>
                  <span className="tabular-nums">
                    {formatBytes(stored.bytes)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Files', snapshot.files.length],
                    ['Datasets', datasetCount],
                    ['Relations', relationshipCount],
                    ['Views', savedViewCount],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {formatInteger(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Stored files
                </p>
                <div className="mt-1.5 space-y-1">
                  {snapshot.files.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No files stored yet.
                    </p>
                  ) : (
                    snapshot.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <FileJson className="h-4 w-4 shrink-0 text-indigo-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {file.datasets.length} dataset
                            {file.datasets.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                          {file.kind.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {snapshot.relationships.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Stored relationships
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {snapshot.relationships.map((relationship) => (
                      <div
                        key={relationship.id}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <span className="font-medium">
                          {relationship.from.label}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">
                          .{relationship.fromColumn}
                        </span>{' '}
                        →{' '}
                        <span className="font-medium">
                          {relationship.to.label}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">
                          .{relationship.toColumn}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Storage key:{' '}
                <span className="font-mono">{WORKSPACE_STORAGE_KEY}</span>
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
              <Vault className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                No workspace saved yet
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Upload a file and it will be stored here automatically.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImportFile(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Import JSON"
            title="Import JSON"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!stored}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Export JSON"
            title="Export JSON"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
