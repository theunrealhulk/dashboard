import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  Database,
  X,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { Dataset } from '../types'
import type {
  RelationshipCandidate,
  RelationshipCardinality,
} from '../lib/relationships'
import { formatInteger } from '../lib/format'

interface RelationshipModalProps {
  first: Dataset
  second: Dataset
  candidates: RelationshipCandidate[]
  acceptedRelationships: RelationshipCandidate[]
  onAccept: (candidate: RelationshipCandidate) => void
  onClose: () => void
}

const cardinalityStyles: Record<RelationshipCardinality, string> = {
  'one-to-one':
    'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  'many-to-one':
    'bg-indigo-50 text-indigo-600 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20',
  'one-to-many':
    'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  'many-to-many':
    'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
}

function describeCandidate(candidate: RelationshipCandidate): string {
  if (!candidate.toUnique) {
    return `${candidate.toColumn} contains duplicate values, so it cannot act as a unique key yet.`
  }

  if (candidate.fromUnique) {
    return `Each ${candidate.to.label} row has at most one matching ${candidate.from.label} row.`
  }

  return `${candidate.to.label} has many ${candidate.from.label} rows.`
}

function DatasetChip({ dataset }: { dataset: Dataset }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <Database className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
          {dataset.label}
        </p>
        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
          {dataset.fileName}
        </p>
      </div>
    </div>
  )
}

function CandidateCard({
  candidate,
  isAccepted,
  onAccept,
}: {
  candidate: RelationshipCandidate
  isAccepted: boolean
  onAccept: (candidate: RelationshipCandidate) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {candidate.from.label}
        </span>
        <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-indigo-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-indigo-400 dark:ring-slate-800">
          {candidate.fromColumn}
        </code>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {candidate.to.label}
        </span>
        <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-indigo-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-indigo-400 dark:ring-slate-800">
          {candidate.toColumn}
        </code>
        {candidate.toUnique && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            foreign key
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {isAccepted ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
              Accepted
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onAccept(candidate)}
              className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-indigo-100 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20 dark:hover:bg-indigo-500/20"
            >
              Accept
            </button>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cardinalityStyles[candidate.cardinality]}`}
          >
            {candidate.cardinality}
          </span>
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {describeCandidate(candidate)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          all {formatInteger(candidate.fromDistinct)} distinct values matched
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {formatInteger(candidate.toDistinct)} values in target
        </span>
        {candidate.toUnique ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            unique target
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            duplicate target
          </span>
        )}
        {candidate.toHasNulls && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            nulls in target
          </span>
        )}
      </div>
    </div>
  )
}

function DirectionSection({
  from,
  to,
  candidates,
  isAccepted,
  onAccept,
}: {
  from: Dataset
  to: Dataset
  candidates: RelationshipCandidate[]
  isAccepted: (candidate: RelationshipCandidate) => boolean
  onAccept: (candidate: RelationshipCandidate) => void
}) {
  if (candidates.length === 0) return null

  return (
    <section className="mt-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {from.label} <span className="text-slate-400">→</span> {to.label}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {candidates.length}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Columns in {from.label} whose distinct values all appear in {to.label}.
      </p>
      <div className="mt-2 space-y-2">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            isAccepted={isAccepted(candidate)}
            onAccept={onAccept}
          />
        ))}
      </div>
    </section>
  )
}

export function RelationshipModal({
  first,
  second,
  candidates,
  acceptedRelationships,
  onAccept,
  onClose,
}: RelationshipModalProps) {
  const forward = useMemo(
    () => candidates.filter((candidate) => candidate.from.id === first.id),
    [candidates, first.id],
  )
  const backward = useMemo(
    () => candidates.filter((candidate) => candidate.from.id === second.id),
    [candidates, second.id],
  )

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
        aria-labelledby="relationship-modal-title"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
            <Cable className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="relationship-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Relationship finder
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Looking for columns whose distinct values are fully contained in
              the other sheet.
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

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
            <DatasetChip dataset={first} />
            <Cable className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <DatasetChip dataset={second} />
          </div>

          {candidates.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
              <Cable className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                No candidate foreign keys found
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                No column had all of its distinct values contained in a column
                of the other sheet. Try datasets that share IDs, emails, or
                other identifiers.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {formatInteger(candidates.length)} candidate relationship
                {candidates.length === 1 ? '' : 's'} found. Strong candidates
                have a unique target column and are listed first.
              </p>
              <DirectionSection
                from={first}
                to={second}
                candidates={forward}
                isAccepted={(candidate) =>
                  acceptedRelationships.some(
                    (accepted) => accepted.id === candidate.id,
                  )
                }
                onAccept={onAccept}
              />
              <DirectionSection
                from={second}
                to={first}
                candidates={backward}
                isAccepted={(candidate) =>
                  acceptedRelationships.some(
                    (accepted) => accepted.id === candidate.id,
                  )
                }
                onAccept={onAccept}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Close this to pick another pair.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
