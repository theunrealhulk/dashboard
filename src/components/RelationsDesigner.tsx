import {
  ChevronLeft,
  Maximize2,
  Minus,
  Plus,
  Sheet,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import * as d3 from 'd3'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RelationshipCandidate } from '../lib/relationships'
import { analyzeColumns, COLUMN_TYPE_LABELS } from '../lib/stats'
import { cellKey } from '../lib/values'
import type { CellValue, ColumnStats, ColumnType, Dataset, EntityColumn } from '../types'
import { NewEntityModal } from './NewEntityModal'

interface RelationsDesignerProps {
  datasets: Dataset[]
  relationships: RelationshipCandidate[]
  onCreateRelationship: (
    fromDatasetId: string,
    fromColumn: string,
    toDatasetId: string,
    toColumn: string,
    linkingSide: 'from' | 'to',
  ) => void
  onDeleteRelationship: (relationshipId: string) => void
  onAddColumn: (
    datasetId: string,
    columnName: string,
    defaultValue?: CellValue,
    type?: ColumnType,
  ) => void
  onCreateEntity: (label: string, columns: EntityColumn[]) => void
  onBack: () => void
}

const NODE_WIDTH = 240
const ROW_HEIGHT = 26
const HEADER_HEIGHT = 46
const TREE_H_GAP = 60
const TREE_V_GAP = 40
const PORT_R = 6

const nodeHeight = (dataset: Dataset) =>
  HEADER_HEIGHT + dataset.columns.length * ROW_HEIGHT + 14

const COLUMN_TYPE_COLORS: Record<ColumnType, string> = {
  number: '#0ea5e9',
  date: '#8b5cf6',
  boolean: '#f59e0b',
  text: '#10b981',
  empty: '#94a3b8',
}

function pickDisplayColumn(
  stats: ColumnStats[],
  idColumn: string,
): ColumnStats | undefined {
  const textColumns = stats.filter(
    (column) => column.type === 'text' && column.name !== idColumn,
  )
  if (textColumns.length === 0) return undefined
  if (textColumns.length === 1) return textColumns[0]

  const preferredNames = ['name', 'label', 'caption']
  const exactMatch = textColumns.find((column) =>
    preferredNames.includes(column.name.toLowerCase()),
  )
  if (exactMatch) return exactMatch

  const partialMatch = textColumns.find((column) =>
    preferredNames.some((name) => column.name.toLowerCase().includes(name)),
  )
  if (partialMatch) return partialMatch

  return (
    textColumns.find(
      (column) => column.nonNull > 0 && column.unique === column.nonNull,
    ) ?? textColumns[0]
  )
}

interface NodePosition {
  id: string
  x: number
  y: number
  height?: number
}

interface Port {
  datasetId: string
  column: string
  x: number
  y: number
  side: 'source' | 'target'
}

interface PendingConnection {
  fromDatasetId: string
  fromColumn: string
  targetDatasetId: string
}

type DragState =
  | { mode: 'port'; port: Port; point: { x: number; y: number } }
  | {
      mode: 'node'
      datasetId: string
      start: { x: number; y: number }
      origin: { x: number; y: number }
    }
  | { mode: 'pan'; start: { x: number; y: number }; transform: d3.ZoomTransform }
  | null

interface ForeignKeyPromptProps {
  sourceLabel: string
  sourceColumn: string
  sourceIdColumn?: string
  sourceIdOptions: { value: CellValue; label: string }[]
  targetLabel: string
  targetColumns: string[]
  defaultName: string
  onCancel: () => void
  onConfirm: (column: string, create: boolean, defaultValue?: CellValue) => void
}

function ForeignKeyPrompt({
  sourceLabel,
  sourceColumn,
  sourceIdColumn,
  sourceIdOptions,
  targetLabel,
  targetColumns,
  defaultName,
  onCancel,
  onConfirm,
}: ForeignKeyPromptProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(
    targetColumns.length > 0 ? 'existing' : 'new',
  )
  const [existingColumn, setExistingColumn] = useState(
    targetColumns.find(
      (column) => column.toLowerCase() === sourceColumn.toLowerCase(),
    ) ??
      targetColumns[0] ??
      '',
  )
  const [newColumn, setNewColumn] = useState(defaultName)
  const [required, setRequired] = useState(false)
  const [hasDefault, setHasDefault] = useState(false)
  const [defaultIndex, setDefaultIndex] = useState('0')

  const trimmed = newColumn.trim()
  const duplicate = targetColumns.some(
    (column) => column.toLowerCase() === trimmed.toLowerCase(),
  )
  const selectedDefault =
    hasDefault && sourceIdOptions.length > 0
      ? (sourceIdOptions[Number(defaultIndex)] ?? sourceIdOptions[0])
      : undefined
  const missingDefault = hasDefault && !selectedDefault
  const canSubmit =
    mode === 'existing'
      ? Boolean(existingColumn)
      : trimmed.length > 0 &&
        !duplicate &&
        !(required && !hasDefault) &&
        !missingDefault

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Connect to {targetLabel}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          You dropped on {targetLabel} without selecting a column. Choose how to
          link{' '}
          <span className="font-mono text-indigo-600 dark:text-indigo-400">
            {sourceLabel}.{sourceColumn}
          </span>
          .
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              checked={mode === 'existing'}
              disabled={targetColumns.length === 0}
              onChange={() => setMode('existing')}
            />
            Use an existing column
          </label>
          <select
            value={existingColumn}
            disabled={mode !== 'existing'}
            onChange={(event) => setExistingColumn(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {targetColumns.length === 0 ? (
              <option value="">No columns available</option>
            ) : (
              targetColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))
            )}
          </select>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            Create a new foreign key column
          </label>
          <input
            type="text"
            value={newColumn}
            disabled={mode !== 'new'}
            onChange={(event) => setNewColumn(event.target.value)}
            placeholder="New column name"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {mode === 'new' && duplicate && (
            <p className="text-xs text-rose-500">
              A column with that name already exists.
            </p>
          )}
          {mode === 'new' && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(event) => {
                    setRequired(event.target.checked)
                    if (event.target.checked) setHasDefault(true)
                  }}
                />
                Required — column cannot be empty
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hasDefault}
                  onChange={(event) => setHasDefault(event.target.checked)}
                />
                Has default ID
              </label>
              {hasDefault && (
                <div className="space-y-1">
                  <select
                    value={defaultIndex}
                    disabled={sourceIdOptions.length === 0}
                    onChange={(event) => setDefaultIndex(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {sourceIdOptions.length === 0 ? (
                      <option value="">No ID values available</option>
                    ) : (
                      sourceIdOptions.map((option, index) => (
                        <option key={`${option.label}-${index}`} value={index}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Existing rows will be filled with this
                    {sourceIdColumn ? ` ${sourceIdColumn}` : ''} value.
                  </p>
                </div>
              )}
              {required && !hasDefault && (
                <p className="text-xs text-rose-500">
                  Required columns cannot be empty. Enable "Has default ID" and
                  choose a value.
                </p>
              )}
              {hasDefault && sourceIdOptions.length === 0 && (
                <p className="text-xs text-rose-500">
                  The source table has no ID values to use as a default.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm(
                mode === 'existing' ? existingColumn : trimmed,
                mode === 'new',
                mode === 'new' && selectedDefault
                  ? selectedDefault.value
                  : undefined,
              )
            }
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}

export function RelationsDesigner({
  datasets,
  relationships,
  onCreateRelationship,
  onDeleteRelationship,
  onAddColumn,
  onCreateEntity,
  onBack,
}: RelationsDesignerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const dragRef = useRef<DragState>(null)

  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: window.innerHeight - 160,
  })
  const [positions, setPositions] = useState<Map<string, NodePosition>>(
    new Map(),
  )
  const [drag, setDrag] = useState<DragState>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null)
  const [newEntityOpen, setNewEntityOpen] = useState(false)

  const [width, setWidth] = useState(containerSize.width)
  const [height, setHeight] = useState(containerSize.height)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
        setWidth(width)
        setHeight(height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Static indented-tree layout: one tree per dataset, columns stacked below.
  // Only newly added datasets are laid out; existing positions (including
  // user-dragged ones) are preserved so links stay attached after moving.
  useEffect(() => {
    if (width <= 0) return

    setPositions((previous) => {
      const next = new Map(previous)
      let changed = false

      for (const id of Array.from(next.keys())) {
        if (!datasets.some((dataset) => dataset.id === id)) {
          next.delete(id)
          changed = true
        }
      }

      let rowBottom = 0
      for (const position of next.values()) {
        rowBottom = Math.max(rowBottom, position.y + (position.height ?? 0))
      }

      let cx = 40
      let cy = next.size > 0 ? rowBottom + TREE_V_GAP : 40
      rowBottom = cy

      for (const dataset of datasets) {
        if (next.has(dataset.id)) continue

        const treeHeight =
          HEADER_HEIGHT + dataset.columns.length * ROW_HEIGHT + 20

        if (cx + NODE_WIDTH > width) {
          cx = 40
          cy = rowBottom + TREE_V_GAP
          rowBottom = cy
        }

        next.set(dataset.id, {
          id: dataset.id,
          x: cx,
          y: cy,
          height: treeHeight,
        })

        cx += NODE_WIDTH + TREE_H_GAP
        rowBottom = Math.max(rowBottom, cy + treeHeight)
        changed = true
      }

      return changed ? next : previous
    })
  }, [datasets, width])

  const primaryKeyByDataset = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const dataset of datasets) {
      map.set(dataset.id, dataset.idColumn)
    }
    return map
  }, [datasets])

  const columnStatsCache = useRef(
    new WeakMap<Dataset, Map<string, ColumnStats>>(),
  )
  const columnStatsByDataset = useMemo(() => {
    const map = new Map<string, Map<string, ColumnStats>>()
    for (const dataset of datasets) {
      let stats = columnStatsCache.current.get(dataset)
      if (!stats) {
        stats = new Map(
          analyzeColumns(
            dataset.rows,
            dataset.columns,
            dataset.columnTypes,
          ).map((column) => [column.name, column]),
        )
        columnStatsCache.current.set(dataset, stats)
      }
      map.set(dataset.id, stats)
    }
    return map
  }, [datasets])
  const ports = useMemo<Port[]>(() => {
    const list: Port[] = []
    for (const dataset of datasets) {
      const position = positions.get(dataset.id)
      if (!position) continue
      for (let i = 0; i < dataset.columns.length; i++) {
        const y =
          position.y +
          HEADER_HEIGHT +
          i * ROW_HEIGHT +
          ROW_HEIGHT / 2 +
          4
        list.push({
          datasetId: dataset.id,
          column: dataset.columns[i],
          x: position.x + NODE_WIDTH,
          y,
          side: 'source',
        })
        list.push({
          datasetId: dataset.id,
          column: dataset.columns[i],
          x: position.x,
          y,
          side: 'target',
        })
      }
    }
    return list
  }, [datasets, positions])

  const portsRef = useRef<Port[]>(ports)
  useEffect(() => {
    portsRef.current = ports
  }, [ports])

  const portAt = useCallback(
    (x: number, y: number): Port | undefined =>
      portsRef.current.find(
        (port) => Math.hypot(port.x - x, port.y - y) <= PORT_R + 8,
      ),
    [],
  )

  const findPort = (x: number, y: number): Port | undefined =>
    ports.find((port) => Math.hypot(port.x - x, port.y - y) <= PORT_R + 8)

  const datasetsRef = useRef(datasets)
  useEffect(() => {
    datasetsRef.current = datasets
  }, [datasets])

  const positionsRef = useRef(positions)
  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  const nodeAt = useCallback(
    (x: number, y: number): Dataset | undefined => {
      for (const dataset of datasetsRef.current) {
        const position = positionsRef.current.get(dataset.id)
        if (!position) continue
        if (
          x >= position.x &&
          x <= position.x + NODE_WIDTH &&
          y >= position.y &&
          y <= position.y + nodeHeight(dataset)
        ) {
          return dataset
        }
      }
      return undefined
    },
    [],
  )

  const findNodeAt = (x: number, y: number): Dataset | undefined => {
    for (const dataset of datasets) {
      const position = positions.get(dataset.id)
      if (!position) continue
      if (
        x >= position.x &&
        x <= position.x + NODE_WIDTH &&
        y >= position.y &&
        y <= position.y + nodeHeight(dataset)
      ) {
        return dataset
      }
    }
    return undefined
  }

  const svgPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current
      if (!svg) return { x: clientX, y: clientY }
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: clientX, y: clientY }
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const transformed = pt.matrixTransform(ctm.inverse())
      return { x: transformed.x, y: transformed.y }
    },
    [],
  )

  const graphPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const point = svgPoint(clientX, clientY)
      const transform = zoomTransformRef.current
      return {
        x: (point.x - transform.x) / transform.k,
        y: (point.y - transform.y) / transform.k,
      }
    },
    [svgPoint],
  )

  const zoom = useMemo(
    () =>
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .filter((event: Event) => {
          if (event.type === 'mousedown' || event.type === 'touchstart') {
            const target = event.target
            if (
              target instanceof Element &&
              target.closest('[data-no-drag]')
            ) {
              return false
            }
          }
          return true
        })
        .on('zoom', (event) => {
          zoomTransformRef.current = event.transform
          if (gRef.current) {
            d3.select(gRef.current).attr(
              'transform',
              `translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`,
            )
          }
          setZoomPercent(Math.round(event.transform.k * 100))
        }),
    [],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    d3.select(svg).call(zoom)
    return () => {
      d3.select(svg).on('.zoom', null)
    }
  }, [zoom])

  const handleZoomIn = useCallback(() => {
    const next = zoomTransformRef.current.scale(
      Math.min(zoomTransformRef.current.k * 1.2, 4),
    )
    zoomTransformRef.current = next
    if (gRef.current) {
      d3.select(gRef.current).attr(
        'transform',
        `translate(${next.x},${next.y}) scale(${next.k})`,
      )
    }
    setZoomPercent(Math.round(next.k * 100))
    const svg = svgRef.current
    if (svg) d3.select(svg).call(zoom.transform, next)
  }, [zoom])

  const handleZoomOut = useCallback(() => {
    const next = zoomTransformRef.current.scale(
      Math.max(zoomTransformRef.current.k / 1.2, 0.25),
    )
    zoomTransformRef.current = next
    if (gRef.current) {
      d3.select(gRef.current).attr(
        'transform',
        `translate(${next.x},${next.y}) scale(${next.k})`,
      )
    }
    setZoomPercent(Math.round(next.k * 100))
    const svg = svgRef.current
    if (svg) d3.select(svg).call(zoom.transform, next)
  }, [zoom])

  const handleResetView = useCallback(() => {
    const next = d3.zoomIdentity
    zoomTransformRef.current = next
    if (gRef.current) {
      d3.select(gRef.current).attr(
        'transform',
        `translate(${next.x},${next.y}) scale(${next.k})`,
      )
    }
    setZoomPercent(100)
    const svg = svgRef.current
    if (svg) d3.select(svg).call(zoom.transform, next)
  }, [])

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()
      const k = Math.min(
        Math.max(
          zoomTransformRef.current.k * (1 - event.deltaY * 0.001),
          0.25,
        ),
        4,
      )
      if (k === zoomTransformRef.current.k) return
      const cx = width / 2
      const cy = height / 2
      const t = k / zoomTransformRef.current.k
      const next = zoomTransformRef.current
        .translate(
          cx - (cx - zoomTransformRef.current.x) * t,
          cy - (cy - zoomTransformRef.current.y) * t,
        )
        .scale(k)
      zoomTransformRef.current = next
      if (gRef.current) {
        d3.select(gRef.current).attr(
          'transform',
          `translate(${next.x},${next.y}) scale(${next.k})`,
        )
      }
      setZoomPercent(Math.round(next.k * 100))
      const svg = svgRef.current
      if (svg) d3.select(svg).call(zoom.transform, next)
    },
    [width, height, zoom],
  )

  const isDragging = drag !== null

  useEffect(() => {
    if (!isDragging) return

    const move = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current) return
      const point = graphPoint(event.clientX, event.clientY)

      if (current.mode === 'port') {
        setDrag((previous) => (previous ? { ...previous, point } : null))
      } else if (current.mode === 'node') {
        const dx = point.x - current.start.x
        const dy = point.y - current.start.y
        setPositions((previous) => {
          const existing = previous.get(current.datasetId)
          if (!existing) return previous
          const next = new Map(previous)
          next.set(current.datasetId, {
            ...existing,
            x: current.origin.x + dx,
            y: current.origin.y + dy,
          })
          return next
        })
      }
    }

    const up = (event: PointerEvent) => {
      const point = graphPoint(event.clientX, event.clientY)
      const current = dragRef.current

      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)

      if (current?.mode === 'port') {
        const target = portAt(point.x, point.y)
        if (target && target.datasetId !== current.port.datasetId) {
          onCreateRelationship(
            current.port.datasetId,
            current.port.column,
            target.datasetId,
            target.column,
            target.side === 'target' ? 'to' : 'from',
          )
        } else if (!target) {
          const targetDataset = nodeAt(point.x, point.y)
          if (
            targetDataset &&
            targetDataset.id !== current.port.datasetId
          ) {
            setPendingConnection({
              fromDatasetId: current.port.datasetId,
              fromColumn: current.port.column,
              targetDatasetId: targetDataset.id,
            })
          }
        }
      }

      setDrag(null)
      dragRef.current = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [isDragging, onCreateRelationship, graphPoint, portAt, nodeAt])

  const isDark = document.documentElement.classList.contains('dark')
  const linkStroke = isDark ? '#475569' : '#cbd5e1'
  const dragPort = drag?.mode === 'port' ? drag.port : undefined
  const hoveredNode =
    drag?.mode === 'port'
      ? findNodeAt(drag.point.x, drag.point.y)
      : undefined
  const hoveredDatasetId =
    hoveredNode && dragPort && hoveredNode.id !== dragPort.datasetId
      ? hoveredNode.id
      : undefined

  const relationshipLink = (
    fromPosition: NodePosition | undefined,
    toPosition: NodePosition | undefined,
    relationship: RelationshipCandidate,
  ) => {
    if (!fromPosition || !toPosition) return null

    const fromIsLeft = fromPosition.x <= toPosition.x
    const fromSide: Port['side'] = fromIsLeft ? 'source' : 'target'
    const toSide: Port['side'] = fromIsLeft ? 'target' : 'source'

    const fromPort = ports.find(
      (p) =>
        p.datasetId === relationship.from.id &&
        p.column === relationship.fromColumn &&
        p.side === fromSide,
    )
    const toPort = ports.find(
      (p) =>
        p.datasetId === relationship.to.id &&
        p.column === relationship.toColumn &&
        p.side === toSide,
    )
    if (!fromPort || !toPort) return null

    const midX = (fromPort.x + toPort.x) / 2
    return (
      <path
        key={relationship.id}
        d={`M ${fromPort.x} ${fromPort.y} Q ${midX} ${fromPort.y} ${toPort.x} ${toPort.y}`}
        stroke={linkStroke}
        strokeOpacity={0.75}
        strokeWidth={1.5}
        fill="none"
        markerEnd="url(#relation-arrow)"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteRelationship(relationship.id)
        }}
        className="cursor-pointer"
      />
    )
  }

  const pendingSource = pendingConnection
    ? datasets.find((dataset) => dataset.id === pendingConnection.fromDatasetId)
    : undefined
  const pendingTarget = pendingConnection
    ? datasets.find(
        (dataset) => dataset.id === pendingConnection.targetDatasetId,
      )
    : undefined
  const pendingDefaultName = pendingConnection
    ? `${pendingSource?.label ?? 'link'}_${pendingConnection.fromColumn}`.replace(
        /[^a-zA-Z0-9_]+/g,
        '_',
      )
    : ''

  const sourceIdColumn = pendingConnection?.fromColumn
  const sourceStats = pendingSource
    ? columnStatsByDataset.get(pendingSource.id)
    : undefined
  const sourceDisplayColumn =
    sourceStats && sourceIdColumn
      ? pickDisplayColumn([...sourceStats.values()], sourceIdColumn)
      : undefined

  const sourceIdOptions: { value: CellValue; label: string }[] = []
  if (pendingSource && pendingConnection && sourceIdColumn) {
    const seen = new Set<string>()
    for (const row of pendingSource.rows) {
      const value = row[sourceIdColumn]
      const label = cellKey(value)
      if (label === null || seen.has(label)) continue
      seen.add(label)
      const text = sourceDisplayColumn
        ? cellKey(row[sourceDisplayColumn.name])
        : null
      sourceIdOptions.push({
        value,
        label: text && text !== label ? `${label} — ${text}` : label,
      })
    }
  }

  return (
    <section className="flex flex-col h-full">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Back to workspace"
          title="Back to workspace"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Relations Designer
          </h2>
          <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {datasets.length} dataset{datasets.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setNewEntityOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
            aria-label="New entity"
            title="New entity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleZoomOut}
              className="rounded-l-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="rounded-r-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="ml-1 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Reset view"
              title="Reset view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <span className="ml-auto hidden text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400 xl:inline">
          Drag a sheet header to move it · Drag between column ports to connect · Pan: drag empty canvas · Zoom: wheel or buttons · Click an edge to remove it
        </span>
      </div>

      <div className="flex-1 relative overflow-auto" ref={containerRef}>
        {datasets.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Sheet className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              No datasets to connect
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Upload a file or create an entity from scratch.
            </p>
            <button
              type="button"
              onClick={() => setNewEntityOpen(true)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-500 p-2 text-white shadow-sm transition hover:bg-indigo-600"
              aria-label="Create entity"
              title="Create entity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="block w-full"
            height={Math.max(height, 400)}
            width="100%"
            onWheel={(event) => handleWheel(event as unknown as WheelEvent)}
          >
            <defs>
              <marker
                id="relation-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill={linkStroke} />
              </marker>
            </defs>

            <g
              ref={gRef}
              transform={`translate(${zoomTransformRef.current.x},${zoomTransformRef.current.y}) scale(${zoomTransformRef.current.k})`}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  event.stopPropagation()
                  const pointerStart = svgPoint(event.clientX, event.clientY)
                  setDrag({
                    mode: 'pan',
                    start: pointerStart,
                    transform: zoomTransformRef.current,
                  })
                  dragRef.current = {
                    mode: 'pan',
                    start: pointerStart,
                    transform: zoomTransformRef.current,
                  }
                }
              }}
            >
              {relationships.map((relationship) =>
                relationshipLink(
                  positions.get(relationship.from.id),
                  positions.get(relationship.to.id),
                  relationship,
                ),
              )}

              {drag?.mode === 'port' && (
                <path
                  d={`M ${drag.port.x} ${drag.port.y} L ${drag.point.x} ${drag.point.y}`}
                  stroke="#94a3b8"
                  strokeOpacity={0.8}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="6 4"
                />
              )}

              {datasets.map((dataset) => {
                const position = positions.get(dataset.id)
                if (!position) return null
                const primaryKey = primaryKeyByDataset.get(dataset.id)
                const columnStats = columnStatsByDataset.get(dataset.id)

                return (
                  <g
                    key={dataset.id}
                    data-no-drag
                    style={{ cursor: 'grab', pointerEvents: 'auto' }}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      const start = graphPoint(event.clientX, event.clientY)
                      const next = {
                        mode: 'node' as const,
                        datasetId: dataset.id,
                        start,
                        origin: { x: position.x, y: position.y },
                      }
                      setDrag(next)
                      dragRef.current = next
                    }}
                  >
                    <rect
                      x={position.x}
                      y={position.y}
                      width={NODE_WIDTH}
                      height={nodeHeight(dataset)}
                      rx="10"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isDark ? '#334155' : '#cbd5e1'}
                      strokeWidth="1"
                    />
                    <g>
                      <rect
                        x={position.x}
                        y={position.y}
                        width={NODE_WIDTH}
                        height={HEADER_HEIGHT}
                        rx="10"
                        fill={isDark ? '#1e293b' : '#f1f5f9'}
                      />
                      <Sheet
                        x={position.x + 12}
                        y={position.y + 15}
                        width={16}
                        height={16}
                        className={`text-${isDark ? 'indigo-400' : 'indigo-500'}`}
                      />
                      <text
                        x={position.x + 40}
                        y={position.y + HEADER_HEIGHT / 2}
                        fill={isDark ? '#e2e8f0' : '#0f172a'}
                        fontSize="13"
                        fontWeight="600"
                        dominantBaseline="middle"
                        pointerEvents="none"
                      >
                        {dataset.label}
                      </text>
                    </g>

                    {dataset.columns.map((column, index) => {
                      const y =
                        position.y +
                        HEADER_HEIGHT +
                        index * ROW_HEIGHT +
                        ROW_HEIGHT / 2 +
                        4
                      const isPrimary = primaryKey === column
                      const columnType =
                        columnStats?.get(column)?.type ?? 'text'
                      const displayName =
                        column.length > 18
                          ? `${column.slice(0, 17)}…`
                          : column
                      const sourcePort = ports.find(
                        (p) =>
                          p.datasetId === dataset.id &&
                          p.column === column &&
                          p.side === 'source',
                      )
                      const targetPort = ports.find(
                        (p) =>
                          p.datasetId === dataset.id &&
                          p.column === column &&
                          p.side === 'target',
                      )
                      const hoverPort = drag?.mode === 'port'
                        ? findPort(drag.point.x, drag.point.y)
                        : undefined
                      const isHoverTarget =
                        hoverPort &&
                        hoverPort.datasetId !== dataset.id &&
                        hoverPort.column === column

                      return (
                        <g key={column} style={{ pointerEvents: 'auto' }}>
                          <rect
                            x={position.x + 8}
                            y={y - ROW_HEIGHT / 2 + 2}
                            width={NODE_WIDTH - 16}
                            height={ROW_HEIGHT - 4}
                            rx={3}
                            fill={
                              hoveredKey === `${dataset.id}::${column}`
                                ? isDark
                                  ? '#1e293b'
                                  : '#f1f5f9'
                                : 'none'
                            }
                            pointerEvents="all"
                            onPointerEnter={() =>
                              setHoveredKey(`${dataset.id}::${column}`)
                            }
                            onPointerLeave={() => setHoveredKey(null)}
                          />
                          <circle
                            cx={sourcePort?.x ?? position.x + NODE_WIDTH}
                            cy={y}
                            r={PORT_R}
                            fill={
                              drag?.mode === 'port' &&
                              drag.port.datasetId === dataset.id &&
                              drag.port.column === column
                                ? '#4f46e5'
                                : hoveredKey === `${dataset.id}::${column}`
                                  ? '#4f46e5'
                                  : isPrimary
                                    ? '#f59e0b'
                                    : '#94a3b8'
                            }
                            stroke={isDark ? '#020617' : '#ffffff'}
                            strokeWidth={1.5}
                            onPointerDown={(event) => {
                              event.stopPropagation()
                              const startPort: Port = sourcePort ?? {
                                datasetId: dataset.id,
                                column,
                                x: position.x + NODE_WIDTH,
                                y,
                                side: 'source',
                              }
                              const next = {
                                mode: 'port' as const,
                                port: startPort,
                                point: { x: startPort.x, y: startPort.y },
                              }
                              setDrag(next)
                              dragRef.current = next
                            }}
                            style={{ cursor: 'crosshair' }}
                          />
                          <circle
                            cx={targetPort?.x ?? position.x}
                            cy={y}
                            r={PORT_R}
                            fill={
                              isHoverTarget
                                ? '#22d3ee'
                                : hoveredKey === `${dataset.id}::${column}`
                                  ? '#22d3ee'
                                  : '#e2e8f0'
                            }
                            stroke={isDark ? '#020617' : '#94a3b8'}
                            strokeWidth={1}
                            onPointerDown={(event) => {
                              event.stopPropagation()
                              const startPort: Port = targetPort ?? {
                                datasetId: dataset.id,
                                column,
                                x: position.x,
                                y,
                                side: 'target',
                              }
                              const next = {
                                mode: 'port' as const,
                                port: startPort,
                                point: { x: startPort.x, y: startPort.y },
                              }
                              setDrag(next)
                              dragRef.current = next
                            }}
                            style={{ cursor: 'crosshair' }}
                          />
                          <text
                            x={position.x + 16}
                            y={y + 4}
                            textAnchor="start"
                            fill={isDark ? '#e2e8f0' : '#0f172a'}
                            fontSize="12"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                          >
                            {displayName}
                            <tspan
                              dx={6}
                              fontSize="9"
                              fontWeight="600"
                              fill={COLUMN_TYPE_COLORS[columnType]}
                            >
                              {COLUMN_TYPE_LABELS[columnType]}
                            </tspan>
                            {isPrimary && (
                              <tspan
                                dx={6}
                                fontSize="9"
                                fontWeight="700"
                                fill="#f59e0b"
                              >
                                PK
                              </tspan>
                            )}
                          </text>
                        </g>
                      )
                    })}
                    {hoveredDatasetId === dataset.id && (
                      <rect
                        x={position.x}
                        y={position.y}
                        width={NODE_WIDTH}
                        height={nodeHeight(dataset)}
                        rx="10"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        )}

        {pendingConnection && pendingSource && pendingTarget && (
          <ForeignKeyPrompt
            sourceLabel={pendingSource.label}
            sourceColumn={pendingConnection.fromColumn}
            sourceIdColumn={sourceIdColumn}
            sourceIdOptions={sourceIdOptions}
            targetLabel={pendingTarget.label}
            targetColumns={pendingTarget.columns}
            defaultName={pendingDefaultName}
            onCancel={() => setPendingConnection(null)}
            onConfirm={(column, create, defaultValue) => {
              if (create) onAddColumn(pendingTarget.id, column, defaultValue)
              onCreateRelationship(
                pendingConnection.fromDatasetId,
                pendingConnection.fromColumn,
                pendingTarget.id,
                column,
                'to',
              )
              setPendingConnection(null)
            }}
          />
        )}

        <p className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-slate-500 dark:text-slate-400 pointer-events-none">
          Drag a sheet header to move it · Drag between column ports to connect · Pan: drag empty canvas · Zoom: wheel or buttons · Click an edge to remove it
        </p>
      </div>

      {newEntityOpen && (
        <NewEntityModal
          onCancel={() => setNewEntityOpen(false)}
          onCreate={(label, columns) => {
            onCreateEntity(label, columns)
            setNewEntityOpen(false)
          }}
        />
      )}

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:py-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
          Connections
        </h3>
        {relationships.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No connections yet.
          </p>
        ) : (
          <div className="space-y-1">
            {relationships.map((relationship) => (
              <div
                key={relationship.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span className="truncate max-w-[120px]">{relationship.from.label}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">.{relationship.fromColumn}</span>
                  <X className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[120px]">{relationship.to.label}</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono">.{relationship.toColumn}</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteRelationship(relationship.id)
                  }}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  aria-label="Remove connection"
                  title="Remove connection"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
