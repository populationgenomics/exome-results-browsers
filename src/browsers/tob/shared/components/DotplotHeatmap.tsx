import React, { useState } from 'react'
// import PropTypes, { arrayOf } from 'prop-types'
// import { scaleBand, scaleSqrt, scaleSequential, interpolateRgb } from 'd3'

import { CategoryFilterControl } from '@gnomad/ui'
import { defaultCellTypeColors } from '../utilities/constants'

interface Options {
  title?: string
  width?: number
  height?: number
  margin?: Margin
  accessors?: Accessors
  toolip?: (d: object) => string | null | undefined // (d) => d.tooltip
  selected?: (d: object) => boolean // (d) => d.selected
  xScale?: Scale
  yScale?: Scale
  sizeScale?: Scale
  colorScale?: Scale
}

interface Accessors {
  x: (d: object) => string // x: (d) => d.x
  y: (d: object) => string // (d) => d.y
  size: (d: object) => number // (d) => d.size
  color: (d: object) => string // (d) => d.color
}

interface Margin {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

interface Scale {
  label?: string
  domain?: number[] | string[]
  range?: number[] | string[]
  ticks?: number[] | string[]
  bandwidth?: number
  (tick: number | string): number | string
}

interface Props {
  id: string
  data: { expression: number; pvalue: number }[]
  onClickFunction?: (d: object) => void
  options?: Options
}

export const DotplotHeatmap: React.FunctionComponent<Props> = ({
  id,
  data,
  onClickFunction,
  options,
}) => {
  const colNamesOrdered = data.map((item) => options.accessors?.x(item))

  const [categorySelections, setCategorySelections] = useState(
    colNamesOrdered.reduce((ac, a) => ({ ...ac, [a]: true }), {})
  )

  const visibleColNames = colNamesOrdered.filter((item) => categorySelections[item])

  const width = 1000
  const height = 500
  const innerWidth = width - options.margin.left - options.margin.right
  const innerHeight = height - options.margin.top - options.margin.bottom
  const tileSpacing = 0.05

  // const xScale = scaleBand().range([0, innerWidth]).domain(visibleColNames).padding(tileSpacing)

  // const rowNamesOrdered = ['Gene1', 'Gene2', 'Gene3']
  // const yScale = scaleBand().range([innerHeight, 0]).domain(rowNamesOrdered).padding(tileSpacing)

  // const colorScale = scaleSequential()
  //   .interpolator(interpolateRgb(minValueColor, maxValueColor))
  //   .domain([minValue, maxValue])
  //   .range([minValueColor, maxValueColor])

  // const sizeScale = scaleSqrt()
  //   .domain([1, 0])
  //   .range([0, Math.min(xScale.bandwidth() / 2, yScale.bandwidth() / 2)])

  return (
    <>
      <CategoryFilterControl
        categories={colNamesOrdered.map((item) => ({
          id: item,
          label: item,
          color: defaultCellTypeColors()[item],
        }))}
        id="category-filter-control-example"
        categorySelections={categorySelections}
        onChange={setCategorySelections}
        style={{}}
      />
      <br />
      <svg width={width} height={height}>
        <defs>
          <pattern
            id="missing-pattern"
            width={4} // hatchsize as a prop?
            height={4} // hatchsize
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width={2} height={4} fill="black" opacity={0.4} />
          </pattern>
          <linearGradient id="linear-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={`${options.colorScale.range[0]}`} />
            <stop offset="100%" stopColor={`${options.colorScale.range[1]}`} />
          </linearGradient>
        </defs>
        <g transform={`translate(${options.margin?.left}, ${options.margin?.top})`}>
          <g id="x-axis">
            <line x2={`${innerWidth}`} stroke="black" />
            <line y1={`${innerHeight}`} y2={`${innerHeight}`} x2={`${innerWidth}`} stroke="black" />
            {options.xScale.domain.map((tick) => (
              <g
                key={tick}
                transform={`translate(${
                  +options.xScale(tick) + options.xScale.bandwidth / 2
                }, ${innerHeight})`}
              >
                <text
                  transform="translate(0, 10)rotate(-90)"
                  style={{ textAnchor: 'end', alignmentBaseline: 'middle' }}
                >
                  {tick}
                </text>
                <line y2={6} stroke="black" />
                <line y2={`-${innerHeight}`} stroke="lightgrey" />
              </g>
            ))}
          </g>
          <g id="y-axis">
            <line y2={`${innerHeight}`} stroke="black" />
            <line x1={`${innerWidth}`} y2={`${innerHeight}`} x2={`${innerWidth}`} stroke="black" />
            {options.yScale.domain.map((tick) => (
              <g
                key={tick}
                transform={`translate(0, ${+options.yScale(tick) + options.yScale.bandwidth / 2})`}
              >
                <text key={tick} style={{ textAnchor: 'end', alignmentBaseline: 'middle' }} x={-6}>
                  {tick}
                </text>
                <line x2={-3} stroke="black" />
                <line x2={`${innerWidth}`} stroke="lightgrey" />
              </g>
            ))}
          </g>
          <g id="tiles">
            {options.xScale.domain.map((HorizontalTick, i) =>
              options.yScale.domain.map((VerticalTick, j) => (
                <circle
                  r={options.sizeScale(data[i * 3 + j].expression)}
                  cx={+options.xScale(HorizontalTick) + options.xScale.bandwidth / 2}
                  cy={+options.yScale(VerticalTick) + options.yScale.bandwidth / 2}
                  stroke="black"
                  fill={`${options.colorScale(data[i * 3 + j].pvalue)}`}
                  onClick={onClickFunction}
                />
              ))
            )}
          </g>
          <g
            id="sizeLegend"
            transform={`translate(${
              width - options.margin.right - options.margin.left + +options.sizeScale.range[1] + 5
            }, 20)`}
          >
            <text fontWeight="bold"> P value </text> <br />
            {options.sizeScale.ticks
              // .filter((size) => size < 1)
              .map((tick, i) => (
                <g transform={`translate(0, ${40 + +options.sizeScale.range[1] * 2 * i})`}>
                  <circle r={options.sizeScale(tick)} stroke="black" fill="none" />
                  <text x={+options.sizeScale.range[1] + 5} style={{ alignmentBaseline: 'middle' }}>
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
          </g>
          <g
            id="colourLegend"
            transform={`translate(${
              width - options.margin.right - options.margin.left + +options.sizeScale.range[1] + 100
            }, 20)`}
          >
            <text fontWeight="bold"> Expression </text> <br />
            <rect
              transform="translate(0, 15)"
              height="240"
              width="40"
              fill="url(#linear-gradient)"
              stroke="black"
            />
            {options.sizeScale.ticks.map((tick, i) => (
              <g transform={`translate(40, ${15 + (i * 240) / 5})`}>
                <line x2={5} stroke="black" />
                <text dx={7} style={{ alignmentBaseline: 'middle' }}>
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </>
  )
}

DotplotHeatmap.propTypes = {}

DotplotHeatmap.defaultProps = {}

export default DotplotHeatmap
