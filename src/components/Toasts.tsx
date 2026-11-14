import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToastMessage } from '../types'

const TOAST_STYLES: Record<
  ToastMessage['kind'],
  { icon: LucideIcon; box: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    box: 'border-emerald-200 bg-white dark:border-emerald-500/30 dark:bg-slate-900',
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    box: 'border-rose-200 bg-white dark:border-rose-500/30 dark:bg-slate-900',
    iconClass: 'text-rose-500 dark:text-rose-400',
  },
  info: {
    icon: Info,
    box: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    iconClass: 'text-indigo-500 dark:text-indigo-400',
  },
}

interface ToastsProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.kind]
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg shadow-slate-900/5 ${style.box}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconClass}`} />
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Dismiss notification"
              title="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
