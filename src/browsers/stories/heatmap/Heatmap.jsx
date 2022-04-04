import React from 'react'
import { scaleBand, scaleSqrt, scaleSequential, interpolateRgb, extent } from 'd3'
import DotplotHeatmap from '../../tob/shared/components/DotplotHeatmap'
import { defaultCellTypeColors } from '../../tob/shared/utilities/constants'

export const Heatmap = () => {
  const columnNames = Object.keys(defaultCellTypeColors())
  const rowNames = ['Gene1', 'Gene2', 'Gene3']
  const data = Array.from({ length: 42 }, (_, i) => ({
    pvalue: Math.random(),
    expression: Math.random(),
    x: columnNames[i % 14],
    y: rowNames[Math.floor(i / 14)],
  }))

  const xAccessor = (d) => d.x
  const yAccessor = (d) => d.y
  const colorAccessor = (d) => d.expression
  const sizeAccessor = (d) => d.pvalue

  const width = 1000
  const height = 500
  const margin = { left: 80, right: 220, top: 80, bottom: 80 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const tileSpacing = 0.05

  const xScale = scaleBand().range([0, innerWidth]).domain(columnNames).padding(tileSpacing)
  const yScale = scaleBand().range([innerHeight, 0]).domain(rowNames).padding(tileSpacing)

  const colorScale = scaleSequential()
    .interpolator(interpolateRgb('#FFFFFF', '#CC0000'))
    .domain(extent(data, colorAccessor))
    .range(['#FFFFFF', '#CC0000'])
    .nice()

  const sizeScale = scaleSqrt()
    .domain(extent(data, sizeAccessor).reverse())
    .range([0, Math.min(xScale.bandwidth() / 2, yScale.bandwidth() / 2)])
    .nice()

  return (
    <DotplotHeatmap
      id="Test"
      data={data}
      options={{
        // title: 'Title',
        width,
        height,
        margin,
        innerWidth,
        innerHeight,
        // xScale,
        // yScale,
        colorScale,
        sizeScale,
        accessors: { x: xAccessor, y: yAccessor, color: colorAccessor, size: sizeAccessor },
      }}
    />
  )
}

export default Heatmap
