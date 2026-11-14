import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Columns3,
  FileSpreadsheet,
  HardDrive,
  Layers,
  Rows3,
  Table2,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { ColumnStats, ColumnType, Dataset } from '../types'
import type { Theme } from '../lib/useTheme'
import {
  analyzeColumns,
  COLUMN_TYPE_LABELS,
  COLUMN_TYPE_STYLES,
  countByType,
} from '../lib/stats'
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatInteger,
  formatNumber,
  kindLabel,
} from '../lib/format'
import { MissingValuesChart } from './MissingValuesChart'

const TYPE_ORDER: ColumnType[] = ['number', 'text', 'date', 'boolean', 'empty']

function summaryFor(column: ColumnStats): string {
  switch (column.type) {
    case 'number':
      if (column.min === undefined || column.max === undefined) {
        return 'Numeric values'
      }
      return `${formatNumber(column.min)} → ${formatNumber(column.max)}${
        column.mean === undefined ? '' : ` · avg ${formatNumber(column.mean)}`
      }`
    case 'date':
      if (!column.dateMin || !column.dateMax) return 'Date values'
      return `${formatDate(column.dateMin)} → ${formatDate(column.dateMax)}`
    case 'boolean':
      return 'True / false'
    case 'text':
      return column.unique === 1
        ? 'Single repeated value'
        : `${formatInteger(column.unique)} distinct values`
    case 'empty':
      return 'No values'
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
        {hint}
      </p>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </dt>
        <dd
          className="truncate text-sm font-medium text-slate-700 dark:text-slate-200"
          title={value}
        >
          {value}
        </dd>
      </div>
    </div>
  )
}

export function InfoTab({
  dataset,
  theme,
}: {
  dataset: Dataset
  theme: Theme
}) {
  const stats = useMemo(
    () => analyzeColumns(dataset.rows, dataset.columns, dataset.columnTypes),
    [dataset],
  )
  const typeCounts = useMemo(() => countByType(stats), [stats])

  const totalCells = dataset.rows.length * dataset.columns.length
  const hasCells = totalCells > 0
  const missingCells = stats.reduce((total, column) => total + column.nulls, 0)
  const filledCells = Math.max(0, totalCells - missingCells)
  const completeness =
    totalCells === 0 ? 0 : Math.round((filledCells / totalCells) * 100)
  const missingColumns = stats.filter((column) => column.nulls > 0).length

  const progressTone =
    completeness >= 90
      ? 'bg-emerald-500'
      : completeness >= 70
        ? 'bg-amber-500'
        : 'bg-rose-500'

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Rows3}
          label="Rows"
          value={formatInteger(dataset.rows.length)}
          hint="Data records parsed"
          tone="bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20"
        />
        <StatCard
          icon={Columns3}
          label="Columns"
          value={formatInteger(dataset.columns.length)}
          hint="Fields detected"
          tone="bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20"
        />
        <StatCard
          icon={Table2}
          label="Cells"
          value={formatInteger(totalCells)}
          hint={`${formatInteger(filledCells)} filled`}
          tone="bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
        />
        <StatCard
          icon={AlertTriangle}
          label="Missing"
          value={formatInteger(missingCells)}
          hint={`${formatInteger(missingColumns)} column${
            missingColumns === 1 ? '' : 's'
          } affected`}
          tone="bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Dataset details
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Where this dataset came from and how it is stored.
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail icon={Tag} label="Label" value={dataset.label} />
            <Detail
              icon={FileSpreadsheet}
              label="Source file"
              value={dataset.fileName}
            />
            <Detail
              icon={Layers}
              label="Format"
              value={kindLabel(dataset.fileKind)}
            />
            <Detail
              icon={Table2}
              label="Sheet"
              value={dataset.sheetName}
            />
            <Detail
              icon={HardDrive}
              label="File size"
              value={formatBytes(dataset.fileSize)}
            />
            <Detail
              icon={CalendarDays}
              label="Uploaded"
              value={formatDateTime(dataset.uploadedAt)}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Data quality
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Completeness across every cell.
          </p>

          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
              {hasCells ? `${completeness}%` : '—'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {formatInteger(filledCells)} / {formatInteger(totalCells)} cells
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${progressTone}`}
              style={{ width: `${hasCells ? completeness : 0}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {TYPE_ORDER.filter((type) => typeCounts[type] > 0).map((type) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${COLUMN_TYPE_STYLES[type]}`}
              >
                {COLUMN_TYPE_LABELS[type]}
                <span className="tabular-nums opacity-70">
                  {typeCounts[type]}
                </span>
              </span>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {!hasCells
              ? 'This dataset has headers but no data rows yet.'
              : missingCells === 0
                ? 'Every cell is filled. Nice and tidy.'
                : `${formatInteger(missingCells)} empty cell${
                    missingCells === 1 ? '' : 's'
                  } detected across ${formatInteger(missingColumns)} column${
                    missingColumns === 1 ? '' : 's'
                  }.`}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Missing values by column
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Columns with empty cells, ordered by count.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {missingColumns} affected
          </span>
        </div>

        <div className="mt-4">
          {missingColumns === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {hasCells ? 'No missing values' : 'No data rows'}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {hasCells
                    ? 'Every column is fully populated.'
                    : 'This sheet only contains column headers.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <MissingValuesChart stats={stats} theme={theme} />
              {missingColumns > 12 && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Showing the top 12 of {missingColumns} affected columns.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Columns
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Detected types, completeness and value ranges.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {stats.length} total
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">Column</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Non-null
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Missing
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Unique
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.map((column, index) => (
                  <tr
                    key={column.name}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2.5 tabular-nums text-slate-400 dark:text-slate-500">
                      {index + 1}
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5">
                      <span
                        className="block truncate font-medium text-slate-700 dark:text-slate-200"
                        title={column.name}
                      >
                        {column.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${COLUMN_TYPE_STYLES[column.type]}`}
                      >
                        {COLUMN_TYPE_LABELS[column.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {formatInteger(column.nonNull)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        column.nulls > 0
                          ? 'font-medium text-rose-600 dark:text-rose-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {formatInteger(column.nulls)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {formatInteger(column.unique)}
                    </td>
                    <td className="max-w-[320px] px-3 py-2.5">
                      <span
                        className="block truncate text-slate-500 dark:text-slate-400"
                        title={summaryFor(column)}
                      >
                        {summaryFor(column)}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500"
                    >
                      This sheet has no columns.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
