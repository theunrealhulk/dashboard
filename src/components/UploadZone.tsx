import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

interface UploadZoneProps {
  loading: boolean
  onFiles: (files: File[]) => void
  onBrowse: () => void
}

export function UploadZone({ loading, onFiles, onBrowse }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition sm:py-14 ${
        dragging
          ? 'border-indigo-400 bg-indigo-50/80 ring-4 ring-indigo-100 dark:border-indigo-500 dark:bg-indigo-500/10 dark:ring-indigo-500/20'
          : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/5'
      }`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition ${
          dragging
            ? 'bg-indigo-500 text-white'
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
        }`}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </span>

      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        {loading
          ? 'Reading your file…'
          : dragging
            ? 'Drop it right here'
            : 'Drop your spreadsheet here'}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {loading
          ? 'Parsing every sheet and preparing your datasets.'
          : 'Drag and drop a CSV or Excel file, or choose one from your device.'}
      </p>

      <button
        type="button"
        onClick={onBrowse}
        disabled={loading}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 p-2.5 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        aria-label="Browse files"
        title="Browse files"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </button>

      <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800 dark:text-slate-400">
          .csv
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800 dark:text-slate-400">
          .xlsx
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800 dark:text-slate-400">
          .xls
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          Multiple files supported
        </span>
      </p>
    </div>
  )
}
