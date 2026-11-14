import {
  axisBottom,
  axisLeft,
  max,
  scaleBand,
  scaleLinear,
  select,
} from 'd3'
import { useEffect, useMemo, useRef } from 'react'
import type { ColumnStats } from '../types'
import type { Theme } from '../lib/useTheme'
import { formatInteger } from '../lib/format'

const MAX_BARS = 12

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

export function MissingValuesChart({
  stats,
  theme,
}: {
  stats: ColumnStats[]
  theme: Theme
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const rows = useMemo(
    () =>
      stats
        .filter((stat) => stat.nulls > 0)
        .sort((a, b) => b.nulls - a.nulls)
        .slice(0, MAX_BARS),
    [stats],
  )

  useEffect(() => {
    const element = svgRef.current
    if (!element || rows.length === 0) return

    const width = 720
    const margin = { top: 4, right: 56, bottom: 30, left: 168 }
    const barHeight = 30
    const height = margin.top + margin.bottom + rows.length * barHeight
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const maxNulls = max(rows, (row) => row.nulls) ?? 1

    const x = scaleLinear().domain([0, maxNulls]).nice().range([0, innerWidth])
    const y = scaleBand<string>()
      .domain(rows.map((row) => row.name))
      .range([0, innerHeight])
      .padding(0.28)

    const palette =
      theme === 'dark'
        ? {
            axis: '#475569',
            tickText: '#94a3b8',
            labelText: '#cbd5e1',
            bar: '#818cf8',
            valueText: '#cbd5e1',
          }
        : {
            axis: '#e2e8f0',
            tickText: '#94a3b8',
            labelText: '#334155',
            bar: '#6366f1',
            valueText: '#475569',
          }

    const svg = select(element)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const chart = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const xAxis = axisBottom(x)
      .ticks(4)
      .tickSizeOuter(0)
      .tickFormat((value) => formatInteger(Number(value)))

    const xGroup = chart
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
    xGroup.select('.domain').attr('stroke', palette.axis)
    xGroup.selectAll('.tick line').attr('stroke', palette.axis)
    xGroup
      .selectAll('.tick text')
      .attr('fill', palette.tickText)
      .attr('font-size', 11)

    chart
      .selectAll('rect.bar')
      .data(rows)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (row) => y(row.name) ?? 0)
      .attr('width', (row) => Math.max(3, x(row.nulls)))
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', palette.bar)
      .append('title')
      .text((row) => `${row.name}: ${formatInteger(row.nulls)} missing`)

    chart
      .selectAll('text.bar-value')
      .data(rows)
      .join('text')
      .attr('class', 'bar-value')
      .attr('x', (row) => x(row.nulls) + 8)
      .attr('y', (row) => (y(row.name) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', palette.valueText)
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .text((row) => formatInteger(row.nulls))

    const yAxis = axisLeft(y)
      .tickSize(0)
      .tickPadding(12)
      .tickFormat((value) => truncate(String(value), 22))

    const yGroup = chart.append('g').attr('class', 'y-axis').call(yAxis)
    yGroup.select('.domain').remove()
    yGroup
      .selectAll('.tick text')
      .attr('fill', palette.labelText)
      .attr('font-size', 11)

    return () => {
      select(element).selectAll('*').remove()
    }
  }, [rows, theme])

  if (rows.length === 0) return null

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <svg
        ref={svgRef}
        className="h-auto w-full min-w-[520px]"
        aria-label="Missing values by column"
      />
    </div>
  )
}
