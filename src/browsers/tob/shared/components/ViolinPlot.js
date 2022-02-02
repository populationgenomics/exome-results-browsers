import React from 'react'
import PropTypes from 'prop-types'

import {
  scaleLinear,
  extent,
  scaleBand,
  bin,
  area,
  curveCatmullRom,
  ascending,
  quantile,
  max,
  min,
} from 'd3'

const CELL_COLOURS = {
  bin: '#332288',
  bmem: '#6699cc',
  cd4et: '#88ccee',
  cd4nc: '#44aa99',
  cd4sox4: '#117733',
  cd8nc: '#999933',
  cd8et: '#ddcc77',
  cd8s100b: '#661100',
  plasma: '#cc6677',
  dc: '#aa4466',
  nk: '#882255',
  nkr: '#aa4499',
  monoc: '#1e1e1e',
  mononc: '#cc0000',
}

const ViolinPlot = ({ width, data, height, margin }) => {
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const padding = 0.05
  const numBins = 30

  const cellLines = Object.keys(data)

  const yScale = scaleLinear()
    .domain(extent(Object.values(data).flat()))
    .range([innerHeight, 0])

  const xScale = scaleBand().range([0, innerWidth]).domain(cellLines).padding(padding)

  const histogram = bin()
    .domain(yScale.domain())
    .thresholds(yScale.ticks(numBins))
    .value((d) => d)

  const sumstat = Object.values(data).map((value) => histogram(value))

  const boxplotStats = Object.values(data).map((item) => {
    const q1 = quantile(item.sort(ascending), 0.25)
    const median = quantile(item.sort(ascending), 0.5)
    const q3 = quantile(item.sort(ascending), 0.75)
    const interQuantileRange = q3 - q1
    const minimum = q1 - 1.5 * interQuantileRange
    const maximum = q3 + 1.5 * interQuantileRange
    return {
      q1,
      median,
      q3,
      interQuantileRange,
      minimum,
      maximum,
    }
  })

  const maxNum = max(sumstat.map((i) => max(i.map((j) => j.length))))

  const xNum = scaleLinear().range([0, xScale.bandwidth()]).domain([-maxNum, maxNum])

  const linesGenerator = area()
    .x0((d) => xNum(-d.length))
    .x1((d) => xNum(d.length))
    .y((d) => yScale(d.x0))
    .curve(curveCatmullRom)

  return (
    <>
      <svg width={width} height={height}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <g transform={`translate(0, ${innerHeight})`}>
            <line x2={`${innerWidth}`} stroke="black" />
            {xScale.domain().map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick) + xScale.bandwidth() / 2}, 0)`}>
                <text style={{ textAnchor: 'middle' }} dy=".71em" y={9}>
                  {tick}
                </text>
                <line y2={6} stroke="black" />
              </g>
            ))}
          </g>
          <line y2={`${innerHeight}`} stroke="black" />
          {yScale.ticks().map((tick) => (
            <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
              <text key={tick} style={{ textAnchor: 'end' }} x={-6} dy=".32em">
                {tick}
              </text>
              <line x2={-3} stroke="black" />
              <line x2={innerWidth} stroke={yScale(tick) === innerHeight ? 'none' : 'lightgrey'} />
            </g>
          ))}
          {sumstat.map((item, i) => (
            <g key={`SumStat${cellLines[i]}`} transform={`translate(${xScale(cellLines[i])}, 0)`}>
              <path
                d={linesGenerator(item)}
                style={{
                  stroke: CELL_COLOURS[cellLines[i]],
                  fill: CELL_COLOURS[cellLines[i]],
                  fillOpacity: 0.5,
                }}
              />
            </g>
          ))}
          {boxplotStats.map((item, i) => (
            <g key={`BoxStat${cellLines[i]}`} transform={`translate(${xScale(cellLines[i])}, 0)`}>
              <line
                x1={xScale.bandwidth() / 2}
                x2={xScale.bandwidth() / 2}
                y1={yScale(item.minimum)}
                y2={yScale(item.maximum)}
                stroke="black"
              />
              <rect
                x={(xScale.bandwidth() * 3) / 8}
                y={yScale(item.q3)}
                height={yScale(item.q1) - yScale(item.q3)}
                width={xScale.bandwidth() / 4}
                style={{ stroke: 'black', fill: 'white' }}
              />
              <line
                x1={(xScale.bandwidth() * 3) / 8}
                x2={(xScale.bandwidth() * 5) / 8}
                y1={yScale(item.median)}
                y2={yScale(item.median)}
                stroke="black"
              />
            </g>
          ))}
        </g>
      </svg>
    </>
  )
}

ViolinPlot.propTypes = {
  data: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  margin: PropTypes.shape({
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    bottom: PropTypes.number,
  }),
  height: PropTypes.number,
  width: PropTypes.number,
}

ViolinPlot.defaultProps = {
  width: 500,
  height: 500,
  margin: { left: 60, right: 40, top: 20, bottom: 60 },
}

export default ViolinPlot
