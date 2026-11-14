import * as d3 from 'd3'
import { useEffect, useMemo, useRef } from 'react'
import { Database } from 'lucide-react'
import { useTheme } from '../lib/useTheme'
import type { RelationshipCandidate } from '../lib/relationships'

interface RelationsTabProps {
  relationships: RelationshipCandidate[]
  selectedDatasetId: string | null
  onOpenDataset: (datasetId: string) => void
}

interface Node extends d3.SimulationNodeDatum {
  id: string
  label: string
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: Node
  target: Node
  relationship: RelationshipCandidate
}

export function RelationsTab({
  relationships,
  selectedDatasetId,
  onOpenDataset,
}: RelationsTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const svgRef = useRef<SVGSVGElement>(null)

  const sheetRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          relationship.from.id === selectedDatasetId ||
          relationship.to.id === selectedDatasetId,
      ),
    [relationships, selectedDatasetId],
  )

  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>()
    for (const relationship of sheetRelationships) {
      if (!map.has(relationship.from.id)) {
        map.set(relationship.from.id, {
          id: relationship.from.id,
          label: relationship.from.label,
        })
      }
      if (!map.has(relationship.to.id)) {
        map.set(relationship.to.id, {
          id: relationship.to.id,
          label: relationship.to.label,
        })
      }
    }
    return map
  }, [sheetRelationships])

  const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap])
  const links = useMemo(
    () =>
      sheetRelationships.map((relationship) => ({
        source: nodeMap.get(relationship.from.id)!,
        target: nodeMap.get(relationship.to.id)!,
        relationship,
      })),
    [sheetRelationships, nodeMap],
  )

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    const width = Math.max(
      320,
      svgRef.current?.parentElement?.clientWidth ?? 320,
    )
    const height = 420
    svg.attr('width', width).attr('height', height).selectAll('*').remove()

    const defs = svg.append('defs')
    defs
      .append('marker')
      .attr('id', 'relation-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', isDark ? '#475569' : '#cbd5e1')

    const nodeFill = isDark ? '#818cf8' : '#4f46e5'
    const nodeStroke = isDark ? '#1e293b' : '#ffffff'
    const selectedStroke = isDark ? '#22d3ee' : '#2563eb'
    const textFill = isDark ? '#e2e8f0' : '#0f172a'
    const linkStroke = isDark ? '#475569' : '#cbd5e1'

    const simulation = d3.forceSimulation<Node, Link>(nodes)
      .force(
        'link',
        d3.forceLink<Node, Link>(links).id((d) => d.id).distance(140),
      )
      .force('charge', d3.forceManyBody<Node>().strength(-450))
      .force('center', d3.forceCenter<Node>(width / 2, height / 2))
      .on('tick', ticked)

    const link = svg
      .append('g')
      .attr('stroke', linkStroke)
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links as unknown as d3.SimulationLinkDatum<Node>[])
      .join('line')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#relation-arrow)')

    link.append('title').text(
      (d) =>
        `${(d.source as unknown as Node).label}.${(d as unknown as Link).relationship.fromColumn} → ${(d.target as unknown as Node).label}.${(d as unknown as Link).relationship.toColumn}`,
    )

    const node = svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes as unknown as d3.SimulationNodeDatum[])
      .join('g')
      .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        onOpenDataset((d as unknown as Node).id)
      })

    node
      .append('circle')
      .attr('r', 14)
      .attr('fill', nodeFill)
      .attr('stroke', (d) =>
        (d as unknown as Node).id === selectedDatasetId
          ? selectedStroke
          : nodeStroke,
      )
      .attr('stroke-width', (d) =>
        (d as unknown as Node).id === selectedDatasetId ? 3 : 2,
      )

    node
      .append('text')
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('fill', textFill)
      .attr('font-size', 11)
      .attr('pointer-events', 'none')
      .text((d) => (d as unknown as Node).label)

    function ticked() {
      link
        .attr('x1', (d) => (d.source as Node).x ?? 0)
        .attr('y1', (d) => (d.source as Node).y ?? 0)
        .attr('x2', (d) => (d.target as Node).x ?? 0)
        .attr('y2', (d) => (d.target as Node).y ?? 0)

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    return () => {
      simulation.stop()
    }
  }, [nodes, links, selectedDatasetId, onOpenDataset, isDark])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Saved relations
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Node graph of accepted column connections between sheets.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {sheetRelationships.length} saved
        </span>
      </div>

      {sheetRelationships.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <Database className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            No saved relations for this sheet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Use the relationship finder in the sidebar and accept a column
            connection. Accepted relations appear here as a graph.
          </p>
        </div>
      ) : (
        <div className="mt-4 relative h-[420px] rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
          <svg ref={svgRef} className="inset-0 w-full h-full" />
          <p className="absolute bottom-1 left-1 right-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
            Nodes are datasets · edges are accepted foreign-key relations ·
            click a node to open that sheet
          </p>
        </div>
      )}
    </section>
  )
}
